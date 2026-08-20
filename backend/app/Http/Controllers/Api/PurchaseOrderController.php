<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Services\PurchaseOrderService;
use App\Support\Present;
use App\Support\TextTools;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Direct port of frontend/lib/api/purchase-orders.ts (CRUD + workflow + stats). */
class PurchaseOrderController extends Controller
{
    public function __construct(private PurchaseOrderService $service)
    {
    }

    public function index(Request $request)
    {
        $query = PurchaseOrder::query()->with(['items', 'supplier', 'warehouse', 'createdByUser', 'approvedByUser'])->when($request->query('trashed') === '1', fn($q) => $q->onlyTrashed());

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($excludeStatus = $request->query('excludeStatus')) {
            $query->where('status', '!=', $excludeStatus);
        }
        if ($supplierId = $request->query('supplierId')) {
            $query->where('supplier_id', $supplierId);
        }
        if ($warehouseId = $request->query('warehouseId')) {
            $query->where('warehouse_id', $warehouseId);
        }
        // `overdue` was replaced by `priority` in the frontend query type.
        if ($priority = $request->query('priority')) {
            $query->where('priority', $priority);
        }
        if ($dateFrom = $request->query('dateFrom')) {
            $query->where('created_at', '>=', $dateFrom);
        }
        if ($dateTo = $request->query('dateTo')) {
            $query->where('created_at', '<=', $dateTo);
        }

        $user = $request->user();
        if ($request->boolean('is_my_drafts')) {
            $query->where('status', 'draft')
                  ->where('created_by', $user->getKey());
        } else {
            // Normal view:
            $query->where(function ($q) use ($user) {
                // Show non-drafts
                $q->where('status', '!=', 'draft')
                  // OR show drafts ONLY IF they are shared with me AND I didn't create them
                  ->orWhere(function ($sub) use ($user) {
                      $sub->where('status', 'draft')
                          ->where('created_by', '!=', $user->getKey())
                          ->whereJsonContains('shared_with', (string) $user->getKey());
                  });
            });
        }

        $orders = $query->get();

        if ($search = $request->query('search')) {
            $orders = $orders->filter(fn ($po) => TextTools::matches([$po->code, $po->supplier->name ?? null], $search))->values();
        }

        // Sort keys are an explicit whitelist; anything else falls back to newest-first.
        $sortBy = $request->query('sortBy');
        $dir = $request->query('sortDir') === 'desc' ? -1 : 1;
        $sorters = [
            'code' => fn ($a, $b) => strcmp($a->code, $b->code),
            'supplier' => fn ($a, $b) => TextTools::compare($a->supplier->name ?? '', $b->supplier->name ?? ''),
            'total' => fn ($a, $b) => PurchaseOrderService::total($a) <=> PurchaseOrderService::total($b),
            'expectedAt' => fn ($a, $b) => $a->expected_at <=> $b->expected_at,
            'createdAt' => fn ($a, $b) => $a->created_at <=> $b->created_at,
        ];

        $orders = isset($sorters[$sortBy])
            ? $orders->sort(fn ($a, $b) => $sorters[$sortBy]($a, $b) * $dir)->values()
            : $orders->sortByDesc('created_at')->values();

        $rows = $orders->map(fn ($po) => $this->service->toRow($po))->all();

        $page = (int) $request->query('page', 1);
        $pageSize = (int) $request->query('pageSize', 10);

        return response()->json(TextTools::paginate($rows, $page, $pageSize));
    }

    public function show(string $id)
    {
        $po = PurchaseOrder::query()->with(['items', 'supplier', 'warehouse', 'createdByUser', 'approvedByUser'])->find($id);
        if (! $po) {
            throw ApiException::notFound('Satın alma siparişi bulunamadı.');
        }

        $productsById = Product::query()
            ->whereIn('id', $po->items->pluck('product_id'))
            ->get()
            ->keyBy('id');

        $row = $this->service->toRow($po);
        $row['items'] = $po->items->map(fn ($i) => Present::poItem($i) + [
            'product' => ($p = $productsById->get($i->product_id)) ? Present::product($p) : null,
        ])->all();

        return response()->json($row);
    }

    public function stats()
    {
        $orders = PurchaseOrder::query()->with('items')->get();
        $now = Carbon::now();
        $weekFromNow = $now->copy()->addDays(7);

        $openOrders = $orders->filter(fn ($po) => in_array($po->status, ['ordered', 'partially_received'], true));
        $nonCancelled = $orders->filter(fn ($po) => $po->status !== 'cancelled');

        // Committed spend: excludes cancelled, and anything not yet actually
        // ordered (draft or still awaiting approval).
        $totalValue = $nonCancelled
            ->filter(fn ($po) => ! in_array($po->status, ['draft', 'pending_approval'], true))
            ->sum(fn ($po) => PurchaseOrderService::total($po));
        $openValue = $openOrders->sum(fn ($po) => PurchaseOrderService::total($po));
        $pendingUnits = $openOrders->sum(fn ($po) => $po->items->sum(fn ($i) => (int) $i->quantity - (int) $i->received_quantity));

        $orderedTotal = $nonCancelled->sum(fn ($po) => $po->items->sum('quantity'));
        $receivedTotal = $nonCancelled->sum(fn ($po) => $po->items->sum('received_quantity'));
        $fillRatePercent = $orderedTotal > 0 ? (int) round(($receivedTotal / $orderedTotal) * 100) : 0;

        $overdue = $orders->filter(fn ($po) => PurchaseOrderService::isOverdue($po, $now));
        $overdueValue = $overdue->sum(fn ($po) => PurchaseOrderService::total($po));

        $arrivingThisWeek = $openOrders
            ->filter(fn ($po) => $po->expected_at && $po->expected_at->gte($now) && $po->expected_at->lte($weekFromNow))
            ->count();

        $receivedOrders = $orders->filter(fn ($po) => $po->status === 'received' && $po->received_at);
        // null (not 0) means "no deliveries yet" — the UI renders that neutrally.
        $onTimeRatePercent = $receivedOrders->count() > 0
            ? (int) round($receivedOrders->filter(fn ($po) => $po->received_at->lte($po->expected_at))->count() / $receivedOrders->count() * 100)
            : null;

        return response()->json([
            'totalOrders' => $orders->count(),
            'openOrders' => $openOrders->count(),
            'pendingUnits' => (int) $pendingUnits,
            'totalValue' => (float) $totalValue,
            'openValue' => (float) $openValue,
            'fillRatePercent' => $fillRatePercent,
            'overdueCount' => $overdue->count(),
            'overdueValue' => (float) $overdueValue,
            'draftCount' => $orders->where('status', 'draft')->count(),
            'pendingApprovalCount' => $orders->where('status', 'pending_approval')->count(),
            'arrivingThisWeek' => $arrivingThisWeek,
            'onTimeRatePercent' => $onTimeRatePercent,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplierId' => ['required', 'string'],
            'warehouseId' => ['required', 'string'],
            'expectedAt' => ['required', 'string'],
            'priority' => ['nullable', 'in:low,medium,high'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array'],
            'items.*.productId' => ['required', 'string'],
            'items.*.quantity' => ['required', 'numeric'],
            'items.*.unitPrice' => ['required', 'numeric'],
            'isDraft' => ['nullable', 'boolean'],
        ]);

        return response()->json($this->service->create($data, $request->user()), 201);
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'supplierId' => ['sometimes', 'string'],
            'warehouseId' => ['sometimes', 'string'],
            'expectedAt' => ['sometimes', 'string'],
            'priority' => ['sometimes', 'in:low,medium,high'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'items' => ['sometimes', 'array'],
            'items.*.productId' => ['required_with:items', 'string'],
            'items.*.quantity' => ['required_with:items', 'numeric'],
            'items.*.unitPrice' => ['required_with:items', 'numeric'],
        ]);

        return response()->json($this->service->update($id, $data, $request->user()));
    }

    public function destroy(Request $request, string $id)
    {
        $this->service->delete($id, $request->user()->getKey());

        return response()->json(null, 204);
    }

    public function markOrdered(string $id)
    {
        return response()->json($this->service->markOrdered($id));
    }

    public function requestApproval(string $id)
    {
        return response()->json($this->service->requestApproval($id));
    }

    public function approve(Request $request, string $id)
    {
        return response()->json($this->service->approve($id, $request->user()));
    }

    public function reject(Request $request, string $id)
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        return response()->json($this->service->reject($id, $data['reason']));
    }

    public function cancel(Request $request, string $id)
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        return response()->json($this->service->cancel($id, $data['reason']));
    }

    public function receive(Request $request, string $id)
    {
        $data = $request->validate([
            'receivedQuantities' => ['required', 'array'],
            'idempotencyKey' => ['nullable', 'string'],
        ]);

        return response()->json($this->service->receive(
            $id,
            $data['receivedQuantities'],
            $request->user()->getKey(),
            $data['idempotencyKey'] ?? null,
        ));
    }

    public function share(Request $request, string $id)
    {
        $data = $request->validate([
            'userIds' => ['present', 'array'],
            'userIds.*' => ['string'],
        ]);

        $po = PurchaseOrder::findOrFail($id);
        
        // Ensure only the creator can share it? Or anyone with manage?
        if ($po->created_by !== $request->user()->getKey() && !$request->user()->can('purchase.approve')) {
            throw ApiException::forbidden('Sadece siparişi oluşturan kişi veya yöneticiler paylaşabilir.');
        }

        $po->shared_with = $data['userIds'];
        $po->save();

        return response()->json($this->service->toRow($po));
    }

    public function uploadInvoice(Request $request, string $id)
    {
        $request->validate([
            'invoice' => ['required', 'file', 'mimes:pdf,jpeg,png,jpg', 'max:5120'],
        ]);

        $po = PurchaseOrder::findOrFail($id);
        
        $path = $request->file('invoice')->store('invoices', 'public');
        $po->invoice_file_path = $path;
        $po->save();

        return response()->json(['invoiceFilePath' => $path]);
    }

    public function bulkOrder(Request $request)
    {
        $data = $request->validate(['ids' => ['required', 'array']]);

        return response()->json($this->service->bulkMarkOrdered($data['ids']));
    }

    public function bulkCancel(Request $request)
    {
        $data = $request->validate(['ids' => ['required', 'array']]);

        return response()->json($this->service->bulkCancel($data['ids']));
    }

    public function bulkDelete(Request $request)
    {
        $data = $request->validate(['ids' => ['required', 'array']]);

        return response()->json($this->service->bulkDelete($data['ids'], $request->user()->getKey()));
    }

    public function restore(string $id)
    {
        $model = \App\Models\PurchaseOrder::withTrashed()->find($id);
        if (!$model) {
            throw \App\Exceptions\ApiException::notFound('Kayıt bulunamadı.');
        }
        $model->restoreTracked();
        return response()->json(['restored' => true]);
    }
}
