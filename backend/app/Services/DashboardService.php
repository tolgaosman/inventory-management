<?php

namespace App\Services;

use App\Support\InventoryCalc;
use App\Support\JsonStore;
use Illuminate\Support\Carbon;

/** Direct PHP port of frontend/lib/mock/dashboard.ts. */
class DashboardService
{
    private const MONTH_LABELS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    public const MONTHS_BY_RANGE = ['bu-ay' => 1, 'son-3-ay' => 3, 'son-6-ay' => 6, 'bu-yil' => 12];

    public function __construct(private JsonStore $store)
    {
    }

    private function isToday(string $iso): bool
    {
        return Carbon::parse($iso)->isToday();
    }

    private function rangeStart(int $months): Carbon
    {
        return Carbon::now()->startOfMonth()->subMonths($months - 1);
    }

    private function movementMatchesWarehouse(array $m, ?string $warehouseId): bool
    {
        return ! $warehouseId || $m['warehouseId'] === $warehouseId || $m['targetWarehouseId'] === $warehouseId;
    }

    public function criticalProducts(array $products, array $totals): array
    {
        $active = array_values(array_filter($products, fn ($p) => $p['status'] === 'aktif'));

        $withStock = array_map(fn ($p) => $p + ['totalStock' => $totals[$p['id']] ?? 0], $active);

        return array_values(array_filter($withStock, fn ($p) => InventoryCalc::isCritical($p, $p['totalStock'])));
    }

    public function kpis(int $months, ?string $warehouseId): array
    {
        $products = $this->store->read('products');
        $warehouses = $this->store->read('warehouses');
        $movements = $this->store->read('stock_movements');
        $stockLevels = $this->store->read('stock_levels');
        $orders = $this->store->read('purchase_orders');
        $users = $this->store->read('users');
        $suppliers = $this->store->read('suppliers');
        $categories = $this->store->read('categories');
        $totals = InventoryCalc::totalsByProduct($stockLevels);

        $scopedMovements = array_values(array_filter($movements, fn ($m) => $this->movementMatchesWarehouse($m, $warehouseId)));
        $scopedLevels = $warehouseId ? array_values(array_filter($stockLevels, fn ($s) => $s['warehouseId'] === $warehouseId)) : $stockLevels;

        $todayMovements = array_values(array_filter($scopedMovements, fn ($m) => $this->isToday($m['createdAt'])));
        $todayIn = array_sum(array_map(fn ($m) => $m['quantity'], array_filter($todayMovements, fn ($m) => $m['type'] === 'giris')));
        $todayOut = array_sum(array_map(fn ($m) => $m['quantity'], array_filter($todayMovements, fn ($m) => $m['type'] === 'cikis')));

        $since = $this->rangeStart($months);
        $scopedOrders = array_values(array_filter($orders, fn ($po) => Carbon::parse($po['createdAt'])->gte($since)));

        $openOrders = array_filter($scopedOrders, fn ($po) => in_array($po['status'], ['ordered', 'partially_received'], true));
        $pendingDeliveries = count(array_filter($scopedOrders, fn ($po) => $po['status'] === 'partially_received'));
        $purchaseTotalValue = array_sum(array_map(
            fn ($po) => array_sum(array_map(fn ($i) => $i['quantity'] * $i['unitPrice'], $po['items'])),
            array_filter($scopedOrders, fn ($po) => $po['status'] !== 'cancelled' && $po['status'] !== 'draft')
        ));
        $cancelledOrders = count(array_filter($scopedOrders, fn ($po) => $po['status'] === 'cancelled'));

        $onHandUnits = array_sum(array_column($scopedLevels, 'quantity'));
        $incomingUnits = array_sum(array_map(
            fn ($po) => array_sum(array_map(fn ($i) => $i['quantity'] - $i['receivedQuantity'], $po['items'])),
            $openOrders
        ));

        return [
            'totalProducts' => count($products),
            'totalWarehouses' => $warehouseId ? 1 : count($warehouses),
            'criticalStockCount' => count($this->criticalProducts($products, $totals)),
            'todayIn' => $todayIn,
            'todayOut' => $todayOut,
            'openPurchaseOrders' => count($openOrders),
            'pendingDeliveries' => $pendingDeliveries,
            'purchaseTotalValue' => $purchaseTotalValue,
            'cancelledOrders' => $cancelledOrders,
            'totalPurchaseOrders' => count($scopedOrders),
            'onHandUnits' => $onHandUnits,
            'incomingUnits' => $incomingUnits,
            'totalUsers' => count($users),
            'totalSuppliers' => count($suppliers),
            'categoryCount' => count($categories),
            'productVariantCount' => count($products),
        ];
    }

    public function monthlyFlow(int $months, ?string $warehouseId): array
    {
        $movements = $this->store->read('stock_movements');
        $now = Carbon::now();
        $buckets = [];
        $order = [];

        for ($i = $months - 1; $i >= 0; $i--) {
            $d = $now->copy()->startOfMonth()->subMonths($i);
            $key = $d->year.'-'.$d->month;
            $order[] = $key;
            $buckets[$key] = ['month' => self::MONTH_LABELS[$d->month - 1], 'inbound' => 0, 'outbound' => 0];
        }

        foreach ($movements as $m) {
            if (! $this->movementMatchesWarehouse($m, $warehouseId)) {
                continue;
            }
            $d = Carbon::parse($m['createdAt']);
            $key = $d->year.'-'.$d->month;
            if (! isset($buckets[$key])) {
                continue;
            }
            if ($m['type'] === 'giris') {
                $buckets[$key]['inbound'] += $m['quantity'];
            }
            if ($m['type'] === 'cikis') {
                $buckets[$key]['outbound'] += $m['quantity'];
            }
        }

        return array_map(fn ($k) => $buckets[$k], $order);
    }

    public function categoryShares(?string $warehouseId): array
    {
        $categories = $this->store->read('categories');
        $products = $this->store->read('products');
        $stockLevels = $this->store->read('stock_levels');
        $totals = InventoryCalc::totalsByProduct($stockLevels);

        $topLevel = array_values(array_filter($categories, fn ($c) => $c['parentId'] === null));

        $shares = array_map(function ($top) use ($categories, $products, $stockLevels, $warehouseId, $totals) {
            $descendantIds = array_merge([$top['id']], array_column(array_filter($categories, fn ($c) => $c['parentId'] === $top['id']), 'id'));
            $categoryProducts = array_values(array_filter($products, fn ($p) => in_array($p['categoryId'], $descendantIds, true)));
            $productIds = array_column($categoryProducts, 'id');

            if ($warehouseId) {
                $units = array_sum(array_map(
                    fn ($s) => $s['quantity'],
                    array_filter($stockLevels, fn ($s) => $s['warehouseId'] === $warehouseId && in_array($s['productId'], $productIds, true))
                ));
            } else {
                $units = array_sum(array_map(fn ($p) => $totals[$p['id']] ?? 0, $categoryProducts));
            }

            return ['categoryId' => $top['id'], 'name' => $top['name'], 'units' => $units];
        }, $topLevel);

        usort($shares, fn ($a, $b) => $b['units'] <=> $a['units']);

        return $shares;
    }

    public function warehouseStockTotals(?string $warehouseId): array
    {
        $warehouses = $this->store->read('warehouses');
        $stockLevels = $this->store->read('stock_levels');
        $scoped = $warehouseId ? array_values(array_filter($warehouses, fn ($w) => $w['id'] === $warehouseId)) : $warehouses;

        $rows = array_map(fn ($wh) => [
            'warehouseId' => $wh['id'],
            'name' => $wh['name'],
            'units' => array_sum(array_column(array_filter($stockLevels, fn ($s) => $s['warehouseId'] === $wh['id']), 'quantity')),
            'capacity' => $wh['capacity'],
        ], $scoped);

        usort($rows, fn ($a, $b) => $b['units'] <=> $a['units']);

        return $rows;
    }

    public function recentMovements(int $limit, ?string $warehouseId): array
    {
        $movements = $this->store->read('stock_movements');
        $products = collect($this->store->read('products'))->keyBy('id');
        $warehouses = collect($this->store->read('warehouses'))->keyBy('id');
        $users = collect($this->store->read('users'))->keyBy('id');

        $rows = array_values(array_filter($movements, fn ($m) => $this->movementMatchesWarehouse($m, $warehouseId)));
        $rows = array_slice($rows, 0, $limit);

        return array_map(function ($m) use ($products, $warehouses, $users) {
            $p = $products->get($m['productId']);
            $w = $warehouses->get($m['warehouseId']);
            $tw = $m['targetWarehouseId'] ? $warehouses->get($m['targetWarehouseId']) : null;
            $u = $users->get($m['userId']);

            return $m + [
                'productName' => $p['name'] ?? 'Bilinmeyen ürün',
                'productImageUrl' => $p['imageUrl'] ?? null,
                'warehouseName' => $w['name'] ?? 'Bilinmeyen depo',
                'targetWarehouseName' => $tw['name'] ?? null,
                'userName' => $u['name'] ?? 'Bilinmeyen kullanıcı',
            ];
        }, $rows);
    }

    public function topMovers(int $limit, ?string $warehouseId): array
    {
        $movements = $this->store->read('stock_movements');
        $products = collect($this->store->read('products'))->keyBy('id');

        $byProduct = [];
        foreach ($movements as $m) {
            if (! $this->movementMatchesWarehouse($m, $warehouseId)) {
                continue;
            }
            $byProduct[$m['productId']] ??= ['count' => 0, 'qty' => 0];
            $byProduct[$m['productId']]['count']++;
            $byProduct[$m['productId']]['qty'] += $m['quantity'];
        }

        $rows = [];
        foreach ($byProduct as $productId => $v) {
            $p = $products->get($productId);
            if (! $p) {
                continue;
            }
            $rows[] = [
                'productId' => $productId,
                'name' => $p['name'],
                'sku' => $p['sku'],
                'movementCount' => $v['count'],
                'totalQuantity' => $v['qty'],
                'imageUrl' => $p['imageUrl'] ?? null,
            ];
        }

        usort($rows, fn ($a, $b) => $b['totalQuantity'] <=> $a['totalQuantity']);

        return array_slice($rows, 0, $limit);
    }
}
