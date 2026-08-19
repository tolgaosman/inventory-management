<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use Illuminate\Http\Request;

/** Direct port of frontend/lib/api/dashboard.ts. */
class DashboardController extends Controller
{
    public function __construct(private DashboardService $service)
    {
    }

    public function show(Request $request)
    {
        $range = $request->query('range', 'son-6-ay');
        $months = DashboardService::MONTHS_BY_RANGE[$range] ?? 6;
        $warehouseId = $request->query('warehouseId') ?: null;

        $critical = $this->service->criticalProducts();

        return response()->json([
            'kpis' => $this->service->kpis($months, $warehouseId),
            // The flow chart always shows at least 5 months so short ranges
            // still render a trend rather than a single bar.
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
        $items = $this->service->criticalProducts();

        return response()->json(['total' => count($items), 'items' => array_slice($items, 0, $limit)]);
    }
}
