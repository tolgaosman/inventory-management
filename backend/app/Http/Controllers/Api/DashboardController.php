<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use App\Support\InventoryCalc;
use App\Support\JsonStore;
use Illuminate\Http\Request;

/** Direct PHP port of frontend/lib/api/dashboard.ts. */
class DashboardController extends Controller
{
    public function __construct(private JsonStore $store, private DashboardService $service)
    {
    }

    public function show(Request $request)
    {
        $range = $request->query('range', 'son-6-ay');
        $months = DashboardService::MONTHS_BY_RANGE[$range] ?? 6;
        $warehouseId = $request->query('warehouseId') ?: null;

        $products = $this->store->read('products');
        $totals = InventoryCalc::totalsByProduct($this->store->read('stock_levels'));
        $critical = $this->service->criticalProducts($products, $totals);

        return response()->json([
            'kpis' => $this->service->kpis($months, $warehouseId),
            'monthlyFlow' => $this->service->monthlyFlow(max($months, 5), $warehouseId),
            'categoryShares' => $this->service->categoryShares($warehouseId),
            'warehouseTotals' => $this->service->warehouseStockTotals($warehouseId),
            'recentMovements' => $this->service->recentMovements(8, $warehouseId),
            'topMovers' => $this->service->topMovers(6, $warehouseId),
            'criticalProducts' => array_slice($critical, 0, 6),
        ]);
    }

    public function criticalStockNotifications(Request $request)
    {
        $limit = (int) $request->query('limit', 5);
        $products = $this->store->read('products');
        $totals = InventoryCalc::totalsByProduct($this->store->read('stock_levels'));
        $items = $this->service->criticalProducts($products, $totals);

        return response()->json(['total' => count($items), 'items' => array_slice($items, 0, $limit)]);
    }
}
