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
use Illuminate\Support\Facades\Storage;

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
        if ($createdBy = $request->query('created_by')) {
            $query->where('created_by', $createdBy);
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

    /**
     * Every order still awaiting (full) receipt — "ordered" (Bekleyen Satın
     * Alımlar) and "partially_received" (Kısmen Teslim Alındı) — regardless
     * of whether its invoice has been uploaded yet. Feeds the "Satın
     * Alınanlar" notification tab and the stock-entry form's purchase-order
     * picker (frontend/components/stock/stock-entry-form.tsx). The invoice
     * is only required at the moment of actually receiving (`receive()`
     * below still enforces that) — it's not a reason to hide an order
     * that's genuinely still outstanding from these "what's pending" views.
     */
    public function pendingReceipt(Request $request)
    {
        $query = PurchaseOrder::query()
            ->with(['items', 'supplier', 'warehouse'])
            ->whereIn('status', ['ordered', 'partially_received']);

        if ($warehouseId = $request->query('warehouseId')) {
            $query->where('warehouse_id', $warehouseId);
        }

        $productsById = null;

        $rows = $query->get()->map(function (PurchaseOrder $po) use (&$productsById) {
            $outstanding = $po->items->filter(fn ($i) => (int) $i->quantity > (int) $i->received_quantity);
            if ($outstanding->isEmpty()) {
                return null;
            }

            $productsById ??= Product::query()->get()->keyBy('id');

            return [
                'id' => $po->id,
                'code' => $po->code,
                'status' => $po->status,
                'supplierId' => $po->supplier_id,
                'supplierName' => $po->supplier->name ?? '-',
                'warehouseId' => $po->warehouse_id,
                'warehouseName' => $po->warehouse->name ?? '-',
                'expectedAt' => $po->expected_at?->toIso8601String(),
                // Informational only — receiving no longer requires an
                // invoice; this just lets the UI show whether one has been
                // uploaded yet and offer an upload control if not.
                'hasInvoice' => (bool) $po->invoice_file_path,
                // Totals span EVERY line, not just the outstanding ones below —
                // a caller can't derive the real receive percentage from `items`
                // alone, since fully-received lines are filtered out of it.
                'orderedTotal' => (int) $po->items->sum('quantity'),
                'receivedTotal' => (int) $po->items->sum('received_quantity'),
                'items' => $outstanding->map(function ($i) use ($productsById) {
                    $p = $productsById->get($i->product_id);

                    return [
                        'productId' => $i->product_id,
                        'productName' => $p->name ?? '-',
                        'sku' => $p->sku ?? '-',
                        'unit' => $p->unit ?? '',
                        'quantity' => (int) $i->quantity,
                        'receivedQuantity' => (int) $i->received_quantity,
                        'outstandingQuantity' => (int) $i->quantity - (int) $i->received_quantity,
                    ];
                })->values()->all(),
            ];
        })->filter()->values()->all();

        return response()->json($rows);
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
        $now = Carbon::now();
        $weekFromNow = $now->copy()->addDays(7);

        $totalOrders = PurchaseOrder::query()->count();
        $openOrdersCount = PurchaseOrder::query()->whereIn('status', ['ordered', 'partially_received'])->count();
        $draftCount = PurchaseOrder::query()->where('status', 'draft')->count();
        $pendingApprovalCount = PurchaseOrder::query()->where('status', 'pending_approval')->count();

        $totalValue = (float) \Illuminate\Support\Facades\DB::table('purchase_order_items')
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->whereNotIn('purchase_orders.status', ['cancelled', 'draft', 'pending_approval'])
            ->sum(\Illuminate\Support\Facades\DB::raw('purchase_order_items.quantity * purchase_order_items.unit_price'));

        $openValue = (float) \Illuminate\Support\Facades\DB::table('purchase_order_items')
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->whereIn('purchase_orders.status', ['ordered', 'partially_received'])
            ->sum(\Illuminate\Support\Facades\DB::raw('purchase_order_items.quantity * purchase_order_items.unit_price'));

        $pendingUnits = (int) \Illuminate\Support\Facades\DB::table('purchase_order_items')
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->whereIn('purchase_orders.status', ['ordered', 'partially_received'])
            ->sum(\Illuminate\Support\Facades\DB::raw('purchase_order_items.quantity - purchase_order_items.received_quantity'));

        $orderedTotal = (int) \Illuminate\Support\Facades\DB::table('purchase_order_items')
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->where('purchase_orders.status', '!=', 'cancelled')
            ->sum('purchase_order_items.quantity');

        $receivedTotal = (int) \Illuminate\Support\Facades\DB::table('purchase_order_items')
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->where('purchase_orders.status', '!=', 'cancelled')
            ->sum('purchase_order_items.received_quantity');

        $fillRatePercent = $orderedTotal > 0 ? (int) round(($receivedTotal / $orderedTotal) * 100) : 0;

        $overdueCount = PurchaseOrder::query()
            ->whereNotIn('status', ['received', 'cancelled'])
            ->whereNotNull('expected_at')
            ->where('expected_at', '<', $now)
            ->count();

        $overdueValue = (float) \Illuminate\Support\Facades\DB::table('purchase_order_items')
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->whereNotIn('purchase_orders.status', ['received', 'cancelled'])
            ->whereNotNull('purchase_orders.expected_at')
            ->where('purchase_orders.expected_at', '<', $now)
            ->sum(\Illuminate\Support\Facades\DB::raw('purchase_order_items.quantity * purchase_order_items.unit_price'));

        $arrivingThisWeek = PurchaseOrder::query()
            ->whereIn('status', ['ordered', 'partially_received'])
            ->whereNotNull('expected_at')
            ->where('expected_at', '>=', $now)
            ->where('expected_at', '<=', $weekFromNow)
            ->count();

        $receivedOrdersCount = PurchaseOrder::query()->where('status', 'received')->whereNotNull('received_at')->count();
        $onTimeRatePercent = null;
        if ($receivedOrdersCount > 0) {
            $onTimeCount = PurchaseOrder::query()
                ->where('status', 'received')
                ->whereNotNull('received_at')
                ->whereColumn('received_at', '<=', 'expected_at')
                ->count();
            $onTimeRatePercent = (int) round(($onTimeCount / $receivedOrdersCount) * 100);
        }

        return response()->json([
            'totalOrders' => $totalOrders,
            'openOrders' => $openOrdersCount,
            'pendingUnits' => $pendingUnits,
            'totalValue' => $totalValue,
            'openValue' => $openValue,
            'fillRatePercent' => $fillRatePercent,
            'overdueCount' => $overdueCount,
            'overdueValue' => $overdueValue,
            'draftCount' => $draftCount,
            'pendingApprovalCount' => $pendingApprovalCount,
            'arrivingThisWeek' => $arrivingThisWeek,
            'onTimeRatePercent' => $onTimeRatePercent,
        ]);
    }

    public function store(Request $request)
    {
        $isDraft = $request->boolean('isDraft');

        $data = $request->validate([
            'supplierId' => ['nullable', 'string'],
            'adhocSupplierName' => ['nullable', 'string'],
            'adhocSupplierEmail' => ['nullable', 'string', 'email'],
            'warehouseId' => ['nullable', 'string'],
            'expectedAt' => ['required', 'string'],
            'priority' => ['nullable', 'in:low,medium,high'],
            'notes' => ['nullable', 'string'],
            'items' => [$isDraft ? 'present' : 'required', 'array'],
            'items.*.productId' => ['nullable', 'string'],
            'items.*.productName' => ['nullable', 'string'],
            'items.*.unit' => ['nullable', 'string'],
            'items.*.quantity' => ['required', 'numeric'],
            'items.*.unitPrice' => ['required', 'numeric'],
            'isDraft' => ['nullable', 'boolean'],
        ]);

        return response()->json($this->service->create($data, $request->user()), 201);
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'supplierId' => ['sometimes', 'nullable', 'string'],
            'adhocSupplierName' => ['sometimes', 'nullable', 'string'],
            'adhocSupplierEmail' => ['sometimes', 'nullable', 'string', 'email'],
            'warehouseId' => ['sometimes', 'nullable', 'string'],
            'expectedAt' => ['sometimes', 'string'],
            'priority' => ['sometimes', 'in:low,medium,high'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'items' => ['sometimes', 'array'],
            'items.*.productId' => ['sometimes', 'nullable', 'string'],
            'items.*.productName' => ['sometimes', 'nullable', 'string'],
            'items.*.unit' => ['sometimes', 'nullable', 'string'],
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
            'warehouseId' => ['nullable', 'string'],
            'idempotencyKey' => ['nullable', 'string'],
        ]);

        return response()->json($this->service->receive(
            $id,
            $data['receivedQuantities'],
            $data['warehouseId'] ?? null,
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

    /**
     * A plain `<a href>` to the /storage/... URL can't force a download: that
     * path is served as a static file (bypassing Laravel), so it carries no
     * Content-Disposition header and the `download` attribute is ignored
     * cross-origin — the browser just opens the PDF in a new tab. Streaming
     * it through the API instead lets us set the header explicitly.
     */
    public function downloadInvoice(string $id)
    {
        $po = PurchaseOrder::findOrFail($id);
        if (! $po->invoice_file_path || ! Storage::disk('public')->exists($po->invoice_file_path)) {
            throw ApiException::notFound('Fatura belgesi bulunamadı.');
        }

        $extension = pathinfo($po->invoice_file_path, PATHINFO_EXTENSION) ?: 'pdf';
        return Storage::disk('public')->download($po->invoice_file_path, "fatura-{$po->code}.{$extension}");
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
