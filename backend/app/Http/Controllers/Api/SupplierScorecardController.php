<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Services\PurchaseOrderService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Direct port of frontend/lib/api/purchase-orders.ts's getSupplierScorecards. */
class SupplierScorecardController extends Controller
{
    private function round1(float $n): float
    {
        return round($n, 1);
    }

    /** Days between two instants (positive = $a is later than $b). */
    private function diffDays(Carbon $a, Carbon $b): float
    {
        return ($a->timestamp - $b->timestamp) / 86400;
    }

    public function index()
    {
        $now = Carbon::now();
        $ordersBySupplier = PurchaseOrder::query()->with('items')->get()->groupBy('supplier_id');
        $productCounts = DB::table('products')
            ->groupBy('supplier_id')
            ->select('supplier_id', DB::raw('COUNT(*) as c'))
            ->pluck('c', 'supplier_id');

        $cards = Supplier::query()->get()->map(function ($supplier) use ($ordersBySupplier, $productCounts, $now) {
            $supplierOrders = $ordersBySupplier->get($supplier->id, collect());
            $nonCancelled = $supplierOrders->filter(fn ($po) => $po->status !== 'cancelled');
            $openOrders = $supplierOrders->filter(fn ($po) => in_array($po->status, ['ordered', 'partially_received'], true));
            $cancelledOrders = $supplierOrders->filter(fn ($po) => $po->status === 'cancelled');
            $receivedOrders = $supplierOrders->filter(fn ($po) => $po->status === 'received' && $po->received_at);

            $orderedTotal = $nonCancelled->sum(fn ($po) => $po->items->sum('quantity'));
            $receivedTotal = $nonCancelled->sum(fn ($po) => $po->items->sum('received_quantity'));

            // null, not 0: "no deliveries yet" is a different state from "0% on time".
            $onTimeRatePercent = $receivedOrders->count() > 0
                ? (int) round($receivedOrders->filter(fn ($po) => $po->received_at->lte($po->expected_at))->count() / $receivedOrders->count() * 100)
                : null;

            $avgLeadDays = $receivedOrders->count() > 0
                ? $this->round1($receivedOrders->sum(fn ($po) => $this->diffDays($po->received_at, $po->created_at)) / $receivedOrders->count())
                : null;

            $promisedLeadDays = $nonCancelled->count() > 0
                ? $this->round1($nonCancelled->sum(fn ($po) => $this->diffDays($po->expected_at, $po->created_at)) / $nonCancelled->count())
                : null;

            $overdue = $supplierOrders->filter(fn ($po) => PurchaseOrderService::isOverdue($po, $now));

            return [
                'supplierId' => $supplier->id,
                'supplierName' => $supplier->name,
                'city' => $supplier->city,
                'totalOrders' => $supplierOrders->count(),
                'openOrders' => $openOrders->count(),
                'cancelledOrders' => $cancelledOrders->count(),
                'totalValue' => (float) $nonCancelled->sum(fn ($po) => PurchaseOrderService::total($po)),
                'openValue' => (float) $openOrders->sum(fn ($po) => PurchaseOrderService::total($po)),
                'fillRatePercent' => $orderedTotal > 0 ? (int) round($receivedTotal / $orderedTotal * 100) : 0,
                'onTimeRatePercent' => $onTimeRatePercent,
                'avgLeadDays' => $avgLeadDays,
                'promisedLeadDays' => $promisedLeadDays,
                'overdueCount' => $overdue->count(),
                'overdueDays' => (int) round($overdue->sum(fn ($po) => max($this->diffDays($now, $po->expected_at), 0))),
                'productCount' => (int) ($productCounts[$supplier->id] ?? 0),
                'lastOrderAt' => optional($supplierOrders->sortByDesc('created_at')->first())->created_at?->format('Y-m-d\TH:i:s.v\Z'),
            ];
        })->sortByDesc('totalValue')->values()->all();

        return response()->json($cards);
    }
}
