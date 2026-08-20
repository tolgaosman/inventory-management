<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Services\DashboardService;
use App\Services\PurchaseOrderService;
use App\Support\Labels;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * frontend/components/reports/reports-client.tsx reads the mock arrays directly
 * and computes everything client-side — there is no existing lib/api/reports.ts
 * contract to port. These endpoints expose the same underlying aggregates
 * (reusing DashboardService/PurchaseOrderService so the numbers agree with the
 * dashboard and satın alma pages) shaped per report tab.
 */
class ReportController extends Controller
{
    public function __construct(
        private DashboardService $dashboard,
        private WarehouseController $warehouses,
    ) {
    }

    private function rangeStart(?string $range): Carbon
    {
        $months = DashboardService::MONTHS_BY_RANGE[$range] ?? 6;

        return Carbon::now()->startOfMonth()->subMonths($months - 1);
    }

    public function products(Request $request)
    {
        $since = $this->rangeStart($request->query('range'));
        $warehouseId = $request->query('warehouseId') ?: null;
        $limit = max((int) $request->query('limit', 10), 1);

        $aggregates = StockMovement::query()
            ->where('created_at', '>=', $since)
            ->when($warehouseId, fn ($q) => $q->where(fn ($q2) => $q2->where('warehouse_id', $warehouseId)->orWhere('target_warehouse_id', $warehouseId)))
            ->groupBy('product_id')
            ->select(
                'product_id',
                DB::raw('COALESCE(SUM(quantity), 0) as total_quantity'),
                DB::raw('COUNT(*) as movement_count'),
            )
            ->orderByDesc('total_quantity')
            ->get();

        $productsById = Product::query()->whereIn('id', $aggregates->pluck('product_id'))->get()->keyBy('id');

        $movers = $aggregates->map(function ($row) use ($productsById) {
            $p = $productsById->get($row->product_id);

            return $p ? [
                'productId' => $row->product_id,
                'name' => $p->name,
                'sku' => $p->sku,
                'totalQuantity' => (int) $row->total_quantity,
                'movementCount' => (int) $row->movement_count,
                'imageUrl' => $p->image_url,
            ] : null;
        })->filter()->values();

        return response()->json([
            'topMovers' => $movers->take($limit)->values()->all(),
            'leastMovers' => $movers->reverse()->take(10)->values()->all(),
            'criticalProducts' => array_slice($this->dashboard->criticalProducts(), 0, 20),
            'totalActiveProducts' => Product::query()->where('status', 'aktif')->count(),
        ]);
    }

    public function warehouses(Request $request)
    {
        $warehouseId = $request->query('warehouseId') ?: null;

        return response()->json([
            'warehouses' => $this->warehouses->detailed()->getData(true),
            'stockTotals' => $this->dashboard->warehouseStockTotals($warehouseId),
        ]);
    }

    public function movements(Request $request)
    {
        $since = $this->rangeStart($request->query('range'));

        $typeCounts = StockMovement::query()
            ->where('created_at', '>=', $since)
            ->groupBy('type')
            ->select('type', DB::raw('COUNT(*) as c'), DB::raw('COALESCE(SUM(quantity), 0) as qty'))
            ->get()
            ->keyBy('type');

        $reasonCounts = StockMovement::query()
            ->where('created_at', '>=', $since)
            ->groupBy('reason')
            ->select('reason', DB::raw('COUNT(*) as c'))
            ->pluck('c', 'reason');

        $total = (int) $typeCounts->sum('c');

        $byType = [];
        foreach (['giris', 'cikis', 'transfer'] as $type) {
            $count = (int) ($typeCounts[$type]->c ?? 0);
            $byType[] = [
                'type' => $type,
                'label' => Labels::movementType($type),
                'count' => $count,
                'totalQuantity' => (int) ($typeCounts[$type]->qty ?? 0),
                'percent' => $total > 0 ? round($count / $total * 100, 1) : 0,
            ];
        }

        $byReason = [];
        foreach (Labels::MOVEMENT_REASON as $reason => $label) {
            $count = (int) ($reasonCounts[$reason] ?? 0);
            if ($count === 0) {
                continue;
            }
            $byReason[] = ['reason' => $reason, 'label' => $label, 'count' => $count];
        }

        return response()->json(['total' => $total, 'byType' => $byType, 'byReason' => $byReason]);
    }

    public function purchasing(Request $request)
    {
        $since = $this->rangeStart($request->query('range'));
        $orders = PurchaseOrder::query()->with('items')->where('created_at', '>=', $since)->get();

        $statusBreakdown = [];
        foreach (Labels::PURCHASE_ORDER_STATUS as $status => $label) {
            $matching = $orders->where('status', $status);
            $statusBreakdown[] = [
                'status' => $status,
                'label' => $label,
                'count' => $matching->count(),
                'value' => (float) $matching->sum(fn ($po) => PurchaseOrderService::total($po)),
            ];
        }

        $nonCancelled = $orders->filter(fn ($po) => $po->status !== 'cancelled');

        $bySupplier = [];
        foreach ($nonCancelled as $po) {
            $bySupplier[$po->supplier_id] = ($bySupplier[$po->supplier_id] ?? 0) + PurchaseOrderService::total($po);
        }
        arsort($bySupplier);

        $supplierNames = Supplier::query()->pluck('name', 'id');
        $topSuppliers = [];
        foreach (array_slice($bySupplier, 0, 5, true) as $supplierId => $value) {
            $topSuppliers[] = [
                'supplierId' => $supplierId,
                'name' => $supplierNames[$supplierId] ?? '-',
                'value' => (float) $value,
            ];
        }

        return response()->json([
            'statusBreakdown' => $statusBreakdown,
            'topSuppliers' => $topSuppliers,
            'totalOrders' => $orders->count(),
            'totalValue' => (float) $nonCancelled->sum(fn ($po) => PurchaseOrderService::total($po)),
        ]);
    }
}
