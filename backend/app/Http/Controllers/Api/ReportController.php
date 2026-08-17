<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use App\Services\PurchaseOrderService;
use App\Support\InventoryCalc;
use App\Support\JsonStore;
use App\Support\Labels;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * frontend/components/reports/reports-client.tsx currently reads the mock
 * arrays directly and computes everything client-side — there's no existing
 * lib/api/reports.ts contract to port. These endpoints expose the same
 * underlying aggregates (reusing DashboardService/PurchaseOrderService so the
 * numbers agree with the dashboard and satın alma pages) shaped per report tab.
 */
class ReportController extends Controller
{
    public function __construct(private JsonStore $store, private DashboardService $dashboard)
    {
    }

    private function rangeStart(?string $range): Carbon
    {
        $months = DashboardService::MONTHS_BY_RANGE[$range] ?? 6;

        return Carbon::now()->startOfMonth()->subMonths($months - 1);
    }

    public function products(Request $request)
    {
        $since = $this->rangeStart($request->query('range'));
        $products = $this->store->read('products');
        $movements = array_values(array_filter($this->store->read('stock_movements'), fn ($m) => Carbon::parse($m['createdAt'])->gte($since)));
        $totals = InventoryCalc::totalsByProduct($this->store->read('stock_levels'));

        $byProduct = [];
        foreach ($movements as $m) {
            $byProduct[$m['productId']] ??= 0;
            $byProduct[$m['productId']] += $m['quantity'];
        }
        $productsById = collect($products)->keyBy('id');
        $movers = [];
        foreach ($byProduct as $productId => $qty) {
            $p = $productsById->get($productId);
            if ($p) {
                $movers[] = ['productId' => $productId, 'name' => $p['name'], 'sku' => $p['sku'], 'totalQuantity' => $qty];
            }
        }
        usort($movers, fn ($a, $b) => $b['totalQuantity'] <=> $a['totalQuantity']);

        $critical = $this->dashboard->criticalProducts($products, $totals);

        return response()->json([
            'topMovers' => array_slice($movers, 0, 10),
            'leastMovers' => array_slice(array_reverse($movers), 0, 10),
            'criticalProducts' => array_slice($critical, 0, 20),
            'totalActiveProducts' => count(array_filter($products, fn ($p) => $p['status'] === 'aktif')),
        ]);
    }

    public function warehouses(Request $request)
    {
        $warehouseId = $request->query('warehouseId') ?: null;

        return response()->json([
            'warehouses' => (new WarehouseController($this->store))->detailed()->getData(true),
            'stockTotals' => $this->dashboard->warehouseStockTotals($warehouseId),
        ]);
    }

    public function movements(Request $request)
    {
        $since = $this->rangeStart($request->query('range'));
        $movements = array_values(array_filter($this->store->read('stock_movements'), fn ($m) => Carbon::parse($m['createdAt'])->gte($since)));

        $total = count($movements);
        $byType = [];
        foreach (['giris', 'cikis', 'transfer'] as $type) {
            $count = count(array_filter($movements, fn ($m) => $m['type'] === $type));
            $byType[] = [
                'type' => $type,
                'label' => Labels::movementType($type),
                'count' => $count,
                'percent' => $total > 0 ? round($count / $total * 100, 1) : 0,
            ];
        }

        $byReason = [];
        foreach (Labels::MOVEMENT_REASON as $reason => $label) {
            $count = count(array_filter($movements, fn ($m) => $m['reason'] === $reason));
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
        $orders = array_values(array_filter($this->store->read('purchase_orders'), fn ($po) => Carbon::parse($po['createdAt'])->gte($since)));
        $suppliersById = collect($this->store->read('suppliers'))->keyBy('id');

        $statusBreakdown = [];
        foreach (Labels::PURCHASE_ORDER_STATUS as $status => $label) {
            $matching = array_filter($orders, fn ($po) => $po['status'] === $status);
            $statusBreakdown[] = [
                'status' => $status,
                'label' => $label,
                'count' => count($matching),
                'value' => array_sum(array_map(fn ($po) => PurchaseOrderService::total($po), $matching)),
            ];
        }

        $bySupplier = [];
        foreach ($orders as $po) {
            if ($po['status'] === 'cancelled') {
                continue;
            }
            $bySupplier[$po['supplierId']] ??= 0;
            $bySupplier[$po['supplierId']] += PurchaseOrderService::total($po);
        }
        arsort($bySupplier);
        $topSuppliers = [];
        foreach (array_slice($bySupplier, 0, 5, true) as $supplierId => $value) {
            $topSuppliers[] = ['supplierId' => $supplierId, 'name' => $suppliersById->get($supplierId)['name'] ?? '-', 'value' => $value];
        }

        return response()->json([
            'statusBreakdown' => $statusBreakdown,
            'topSuppliers' => $topSuppliers,
            'totalOrders' => count($orders),
            'totalValue' => array_sum(array_map(fn ($po) => PurchaseOrderService::total($po), array_filter($orders, fn ($po) => $po['status'] !== 'cancelled'))),
        ]);
    }
}
