<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\StockMovement;
use App\Services\PurchaseOrderService;
use App\Support\Present;
use Illuminate\Http\Request;

/**
 * frontend/components/calendar/calendar-client.tsx used to load everything
 * client-side with pageSize: 2000. This is the proper date-range endpoint —
 * pass ?from=&to= (ISO dates) to scope both movements and orders.
 */
class CalendarController extends Controller
{
    public function __construct(private PurchaseOrderService $service)
    {
    }

    public function index(Request $request)
    {
        $from = $request->query('from');
        $to = $request->query('to');

        $movements = StockMovement::query()
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($m) => Present::movement($m))
            ->all();

        $orderRows = PurchaseOrder::query()
            ->with(['items', 'supplier', 'warehouse'])
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($po) => $this->service->toRow($po))
            ->all();

        return response()->json(['movements' => $movements, 'purchaseOrders' => $orderRows]);
    }
}
