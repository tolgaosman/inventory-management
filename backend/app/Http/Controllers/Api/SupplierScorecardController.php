<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PurchaseOrderService;
use App\Support\JsonStore;
use Illuminate\Support\Carbon;

/** Direct PHP port of frontend/lib/api/purchase-orders.ts's getSupplierScorecards. */
class SupplierScorecardController extends Controller
{
    public function __construct(private JsonStore $store)
    {
    }

    /** Days from $bIso to $aIso (positive = a is later than b) — mirrors purchase-orders.ts's diffDays. */
    private function diffDays(string $aIso, string $bIso): float
    {
        return (Carbon::parse($aIso)->timestamp - Carbon::parse($bIso)->timestamp) / 86400;
    }

    private function round1(float $n): float
    {
        return round($n, 1);
    }

    public function index()
    {
        $suppliers = $this->store->read('suppliers');
        $orders = $this->store->read('purchase_orders');
        $products = $this->store->read('products');
        $now = Carbon::now()->toIso8601String();

        $cards = array_map(function ($supplier) use ($orders, $products, $now) {
            $supplierOrders = array_values(array_filter($orders, fn ($po) => $po['supplierId'] === $supplier['id']));
            $nonCancelled = array_values(array_filter($supplierOrders, fn ($po) => $po['status'] !== 'cancelled'));
            $openOrders = array_values(array_filter($supplierOrders, fn ($po) => in_array($po['status'], ['ordered', 'partially_received'], true)));
            $cancelledOrders = array_values(array_filter($supplierOrders, fn ($po) => $po['status'] === 'cancelled'));
            $receivedOrders = array_values(array_filter($supplierOrders, fn ($po) => $po['status'] === 'received' && $po['receivedAt']));

            $orderedTotal = array_sum(array_map(fn ($po) => array_sum(array_column($po['items'], 'quantity')), $nonCancelled));
            $receivedTotal = array_sum(array_map(fn ($po) => array_sum(array_column($po['items'], 'receivedQuantity')), $nonCancelled));

            $onTimeRatePercent = count($receivedOrders) > 0
                ? (int) round(count(array_filter($receivedOrders, fn ($po) => $po['receivedAt'] <= $po['expectedAt'])) / count($receivedOrders) * 100)
                : null;

            $avgLeadDays = count($receivedOrders) > 0
                ? $this->round1(array_sum(array_map(fn ($po) => $this->diffDays($po['receivedAt'], $po['createdAt']), $receivedOrders)) / count($receivedOrders))
                : null;

            $promisedLeadDays = count($nonCancelled) > 0
                ? $this->round1(array_sum(array_map(fn ($po) => $this->diffDays($po['expectedAt'], $po['createdAt']), $nonCancelled)) / count($nonCancelled))
                : null;

            $overdue = array_values(array_filter($supplierOrders, fn ($po) => PurchaseOrderService::isOverdue($po, $now)));

            return [
                'supplierId' => $supplier['id'],
                'supplierName' => $supplier['name'],
                'city' => $supplier['city'],
                'totalOrders' => count($supplierOrders),
                'openOrders' => count($openOrders),
                'cancelledOrders' => count($cancelledOrders),
                'totalValue' => array_sum(array_map(fn ($po) => PurchaseOrderService::total($po), $nonCancelled)),
                'openValue' => array_sum(array_map(fn ($po) => PurchaseOrderService::total($po), $openOrders)),
                'fillRatePercent' => $orderedTotal > 0 ? (int) round($receivedTotal / $orderedTotal * 100) : 0,
                'onTimeRatePercent' => $onTimeRatePercent,
                'avgLeadDays' => $avgLeadDays,
                'promisedLeadDays' => $promisedLeadDays,
                'overdueCount' => count($overdue),
                'overdueDays' => (int) round(array_sum(array_map(fn ($po) => max($this->diffDays($now, $po['expectedAt']), 0), $overdue))),
                'productCount' => count(array_filter($products, fn ($p) => $p['supplierId'] === $supplier['id'])),
                'lastOrderAt' => $supplierOrders[0]['createdAt'] ?? null,
            ];
        }, $suppliers);

        usort($cards, fn ($a, $b) => $b['totalValue'] <=> $a['totalValue']);

        return response()->json($cards);
    }
}
