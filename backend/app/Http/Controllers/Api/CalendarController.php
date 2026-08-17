<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PurchaseOrderService;
use App\Support\JsonStore;
use Illuminate\Http\Request;

/**
 * frontend/components/calendar/calendar-client.tsx currently loads everything
 * client-side with pageSize: 2000. This gives it a proper date-range endpoint
 * instead — pass ?from=&to= (ISO dates) to scope both movements and orders.
 */
class CalendarController extends Controller
{
    public function __construct(private JsonStore $store)
    {
    }

    public function index(Request $request)
    {
        $from = $request->query('from');
        $to = $request->query('to');

        $movements = $this->store->read('stock_movements');
        if ($from) {
            $movements = array_values(array_filter($movements, fn ($m) => $m['createdAt'] >= $from));
        }
        if ($to) {
            $movements = array_values(array_filter($movements, fn ($m) => $m['createdAt'] <= $to));
        }

        $orders = $this->store->read('purchase_orders');
        if ($from) {
            $orders = array_values(array_filter($orders, fn ($po) => $po['createdAt'] >= $from));
        }
        if ($to) {
            $orders = array_values(array_filter($orders, fn ($po) => $po['createdAt'] <= $to));
        }

        $suppliersById = collect($this->store->read('suppliers'))->keyBy('id')->all();
        $warehousesById = collect($this->store->read('warehouses'))->keyBy('id')->all();
        $poService = app(PurchaseOrderService::class);
        $orderRows = array_map(fn ($po) => $poService->toRow($po, $suppliersById, $warehousesById), $orders);

        return response()->json(['movements' => $movements, 'purchaseOrders' => $orderRows]);
    }
}
