<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\PurchaseOrderService;
use App\Support\JsonStore;
use App\Support\TextTools;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Direct PHP port of frontend/lib/api/purchase-orders.ts (CRUD + workflow + stats). */
class PurchaseOrderController extends Controller
{
    public function __construct(private JsonStore $store, private PurchaseOrderService $service)
    {
    }

    private function sorters(): array
    {
        $suppliersById = collect($this->store->read('suppliers'))->keyBy('id');

        return [
            'code' => fn ($a, $b) => strcmp($a['code'], $b['code']),
            'supplier' => fn ($a, $b) => strcmp(
                $suppliersById->get($a['supplierId'])['name'] ?? '',
                $suppliersById->get($b['supplierId'])['name'] ?? ''
            ),
            'total' => fn ($a, $b) => PurchaseOrderService::total($a) <=> PurchaseOrderService::total($b),
            'expectedAt' => fn ($a, $b) => strcmp($a['expectedAt'], $b['expectedAt']),
            'createdAt' => fn ($a, $b) => strcmp($a['createdAt'], $b['createdAt']),
        ];
    }

    public function index(Request $request)
    {
        $orders = $this->store->read('purchase_orders');
        $suppliersById = collect($this->store->read('suppliers'))->keyBy('id')->all();
        $warehousesById = collect($this->store->read('warehouses'))->keyBy('id')->all();

        if ($status = $request->query('status')) {
            $orders = array_values(array_filter($orders, fn ($r) => $r['status'] === $status));
        }
        if ($supplierId = $request->query('supplierId')) {
            $orders = array_values(array_filter($orders, fn ($r) => $r['supplierId'] === $supplierId));
        }
        if ($warehouseId = $request->query('warehouseId')) {
            $orders = array_values(array_filter($orders, fn ($r) => $r['warehouseId'] === $warehouseId));
        }
        if ($dateFrom = $request->query('dateFrom')) {
            $orders = array_values(array_filter($orders, fn ($r) => $r['createdAt'] >= $dateFrom));
        }
        if ($dateTo = $request->query('dateTo')) {
            $orders = array_values(array_filter($orders, fn ($r) => $r['createdAt'] <= $dateTo));
        }
        if ($request->boolean('overdue')) {
            $now = Carbon::now()->toIso8601String();
            $orders = array_values(array_filter($orders, fn ($r) => PurchaseOrderService::isOverdue($r, $now)));
        }
        if ($search = $request->query('search')) {
            $orders = array_values(array_filter($orders, fn ($r) => TextTools::matches([$r['code'], $suppliersById[$r['supplierId']]['name'] ?? null], $search)));
        }

        $sortBy = $request->query('sortBy');
        $sorters = $this->sorters();
        if ($sortBy && isset($sorters[$sortBy])) {
            $sorter = $sorters[$sortBy];
            $dir = $request->query('sortDir') === 'desc' ? -1 : 1;
            usort($orders, fn ($a, $b) => $sorter($a, $b) * $dir);
        } else {
            usort($orders, fn ($a, $b) => strcmp($b['createdAt'], $a['createdAt']));
        }

        $rows = array_map(fn ($po) => $this->service->toRow($po, $suppliersById, $warehousesById), $orders);

        $page = (int) $request->query('page', 1);
        $pageSize = (int) $request->query('pageSize', 10);

        return response()->json(TextTools::paginate($rows, $page, $pageSize));
    }

    public function show(string $id)
    {
        $po = collect($this->store->read('purchase_orders'))->firstWhere('id', $id);
        if (! $po) {
            throw ApiException::notFound('Satın alma siparişi bulunamadı.');
        }
        $suppliersById = collect($this->store->read('suppliers'))->keyBy('id')->all();
        $warehousesById = collect($this->store->read('warehouses'))->keyBy('id')->all();
        $productsById = collect($this->store->read('products'))->keyBy('id');

        $row = $this->service->toRow($po, $suppliersById, $warehousesById);
        $row['items'] = array_map(fn ($i) => $i + ['product' => $productsById->get($i['productId'])], $po['items']);

        return response()->json($row);
    }

    public function stats()
    {
        $orders = $this->store->read('purchase_orders');
        $now = Carbon::now()->toIso8601String();
        $weekFromNow = Carbon::now()->addDays(7)->toIso8601String();

        $openOrders = array_values(array_filter($orders, fn ($po) => in_array($po['status'], ['ordered', 'partially_received'], true)));
        $nonCancelled = array_values(array_filter($orders, fn ($po) => $po['status'] !== 'cancelled'));
        $totalValue = array_sum(array_map(fn ($po) => PurchaseOrderService::total($po), array_filter($nonCancelled, fn ($po) => $po['status'] !== 'draft')));
        $openValue = array_sum(array_map(fn ($po) => PurchaseOrderService::total($po), $openOrders));
        $pendingUnits = array_sum(array_map(fn ($po) => array_sum(array_map(fn ($i) => $i['quantity'] - $i['receivedQuantity'], $po['items'])), $openOrders));

        $orderedTotal = array_sum(array_map(fn ($po) => array_sum(array_column($po['items'], 'quantity')), $nonCancelled));
        $receivedTotal = array_sum(array_map(fn ($po) => array_sum(array_column($po['items'], 'receivedQuantity')), $nonCancelled));
        $fillRatePercent = $orderedTotal > 0 ? (int) round(($receivedTotal / $orderedTotal) * 100) : 0;

        $overdue = array_values(array_filter($orders, fn ($po) => PurchaseOrderService::isOverdue($po, $now)));
        $overdueValue = array_sum(array_map(fn ($po) => PurchaseOrderService::total($po), $overdue));

        $arrivingThisWeek = count(array_filter($openOrders, fn ($po) => $po['expectedAt'] >= $now && $po['expectedAt'] <= $weekFromNow));

        $receivedOrders = array_values(array_filter($orders, fn ($po) => $po['status'] === 'received' && $po['receivedAt']));
        $onTimeRatePercent = count($receivedOrders) > 0
            ? (int) round(count(array_filter($receivedOrders, fn ($po) => $po['receivedAt'] <= $po['expectedAt'])) / count($receivedOrders) * 100)
            : null;

        return response()->json([
            'totalOrders' => count($orders),
            'openOrders' => count($openOrders),
            'pendingUnits' => $pendingUnits,
            'totalValue' => $totalValue,
            'openValue' => $openValue,
            'fillRatePercent' => $fillRatePercent,
            'overdueCount' => count($overdue),
            'overdueValue' => $overdueValue,
            'draftCount' => count(array_filter($orders, fn ($po) => $po['status'] === 'draft')),
            'arrivingThisWeek' => $arrivingThisWeek,
            'onTimeRatePercent' => $onTimeRatePercent,
        ]);
    }

    private function itemsRule(): array
    {
        return [
            'items' => ['required', 'array'],
            'items.*.productId' => ['required', 'string'],
            'items.*.quantity' => ['required', 'numeric'],
            'items.*.unitPrice' => ['required', 'numeric'],
        ];
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplierId' => ['required', 'string'],
            'warehouseId' => ['required', 'string'],
            'expectedAt' => ['required', 'string'],
            'notes' => ['nullable', 'string'],
        ] + $this->itemsRule());

        return response()->json($this->service->create($data), 201);
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'supplierId' => ['sometimes', 'string'],
            'warehouseId' => ['sometimes', 'string'],
            'expectedAt' => ['sometimes', 'string'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'items' => ['sometimes', 'array'],
            'items.*.productId' => ['required_with:items', 'string'],
            'items.*.quantity' => ['required_with:items', 'numeric'],
            'items.*.unitPrice' => ['required_with:items', 'numeric'],
        ]);

        return response()->json($this->service->update($id, $data));
    }

    public function destroy(string $id)
    {
        $this->service->delete($id);

        return response()->json(null, 204);
    }

    public function markOrdered(string $id)
    {
        return response()->json($this->service->markOrdered($id));
    }

    public function cancel(string $id)
    {
        return response()->json($this->service->cancel($id));
    }

    public function receive(Request $request, string $id)
    {
        $data = $request->validate([
            'receivedQuantities' => ['required', 'array'],
            'idempotencyKey' => ['nullable', 'string'],
        ]);
        $userId = $request->user('api-token')->id();

        $po = $this->service->receive($id, $data['receivedQuantities'], $userId, $data['idempotencyKey'] ?? null);

        $suppliersById = collect($this->store->read('suppliers'))->keyBy('id')->all();
        $warehousesById = collect($this->store->read('warehouses'))->keyBy('id')->all();

        return response()->json($this->service->toRow($po, $suppliersById, $warehousesById));
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

        return response()->json($this->service->bulkDelete($data['ids']));
    }
}
