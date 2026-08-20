<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Present;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/** Direct port of frontend/lib/mock/dashboard.ts. */
class DashboardService
{
    private const MONTH_LABELS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    public const MONTHS_BY_RANGE = ['bu-ay' => 1, 'son-3-ay' => 3, 'son-6-ay' => 6, 'bu-yil' => 12];

    private function rangeStart(int $months): Carbon
    {
        return Carbon::now()->startOfMonth()->subMonths($months - 1);
    }

    /** Transfers count for both the source and the destination warehouse. */
    private function scopeToWarehouse($query, ?string $warehouseId)
    {
        return $query->when($warehouseId, fn ($q) => $q->where(
            fn ($inner) => $inner->where('warehouse_id', $warehouseId)->orWhere('target_warehouse_id', $warehouseId)
        ));
    }

    /** @return array<string,int> */
    public function totalsByProduct(): array
    {
        return Cache::remember('dashboard:totals_by_product', 60, fn () =>
            DB::table('stock_levels')
                ->groupBy('product_id')
                ->select('product_id', DB::raw('COALESCE(SUM(quantity), 0) as units'))
                ->pluck('units', 'product_id')
                ->map(fn ($v) => (int) $v)
                ->all()
        );
    }

    /** Active products whose total stock has fallen below their minimum. */
    public function criticalProducts(?array $totals = null): array
    {
        return Cache::remember('dashboard:critical_products', 60, function () use ($totals) {
            $totals ??= $this->totalsByProduct();

            return Product::query()->where('status', 'aktif')->get()
                ->map(fn ($p) => Present::product($p) + ['totalStock' => $totals[$p->id] ?? 0])
                ->filter(fn ($p) => $p['totalStock'] < $p['minStock'])
                ->values()
                ->all();
        });
    }

    public function kpis(int $months, ?string $warehouseId): array
    {
        $cacheKey = "dashboard:kpis:{$months}:" . ($warehouseId ?? 'all');

        return Cache::remember($cacheKey, 60, function () use ($months, $warehouseId) {
            $totals = $this->totalsByProduct();

            $todayFlow = $this->scopeToWarehouse(StockMovement::query(), $warehouseId)
                ->whereBetween('created_at', [Carbon::today()->startOfDay(), Carbon::today()->endOfDay()])
                ->groupBy('type')
                ->select('type', DB::raw('COALESCE(SUM(quantity), 0) as qty'))
                ->pluck('qty', 'type');

            $onHandUnits = (int) DB::table('stock_levels')
                ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId))
                ->sum('quantity');

            $since = $this->rangeStart($months);
            // Purchase orders have no warehouse dimension in the UI's filter model,
            // so they're scoped by date only. Real DB aggregates instead of pulling
            // every order + line item into PHP (matches PurchaseOrderController::stats()).
            $openOrdersCount = PurchaseOrder::query()
                ->whereIn('status', ['ordered', 'partially_received'])
                ->where('created_at', '>=', $since)
                ->count();

            $purchaseTotalValue = (float) DB::table('purchase_order_items')
                ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
                ->whereNotIn('purchase_orders.status', ['cancelled', 'draft', 'pending_approval'])
                ->where('purchase_orders.created_at', '>=', $since)
                ->sum(DB::raw('purchase_order_items.quantity * purchase_order_items.unit_price'));

            $incomingUnits = (int) DB::table('purchase_order_items')
                ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
                ->whereIn('purchase_orders.status', ['ordered', 'partially_received'])
                ->where('purchase_orders.created_at', '>=', $since)
                ->sum(DB::raw('purchase_order_items.quantity - purchase_order_items.received_quantity'));

            $pendingDeliveries = PurchaseOrder::query()
                ->where('status', 'partially_received')
                ->where('created_at', '>=', $since)
                ->count();

            $cancelledOrders = PurchaseOrder::query()
                ->where('status', 'cancelled')
                ->where('created_at', '>=', $since)
                ->count();

            $totalPurchaseOrders = PurchaseOrder::query()
                ->where('status', '!=', 'draft')
                ->where('created_at', '>=', $since)
                ->count();

            return [
                'totalProducts' => Product::query()->count(),
                'totalWarehouses' => $warehouseId ? 1 : Warehouse::query()->count(),
                'criticalStockCount' => count($this->criticalProducts($totals)),
                'todayIn' => (int) ($todayFlow['giris'] ?? 0),
                'todayOut' => (int) ($todayFlow['cikis'] ?? 0),
                'openPurchaseOrders' => $openOrdersCount,
                'pendingDeliveries' => $pendingDeliveries,
                'purchaseTotalValue' => $purchaseTotalValue,
                'cancelledOrders' => $cancelledOrders,
                'totalPurchaseOrders' => $totalPurchaseOrders,
                'onHandUnits' => $onHandUnits,
                'incomingUnits' => $incomingUnits,
                'totalUsers' => User::query()->count(),
                'totalSuppliers' => Supplier::query()->count(),
                'categoryCount' => Category::query()->count(),
                'productVariantCount' => Product::query()->count(),
            ];
        });
    }

    public function monthlyFlow(int $months, ?string $warehouseId): array
    {
        $now = Carbon::now();
        $buckets = [];
        $order = [];

        for ($i = $months - 1; $i >= 0; $i--) {
            $d = $now->copy()->startOfMonth()->subMonths($i);
            $key = $d->year.'-'.$d->month;
            $order[] = $key;
            $buckets[$key] = ['month' => self::MONTH_LABELS[$d->month - 1], 'inbound' => 0, 'outbound' => 0];
        }

        $movements = $this->scopeToWarehouse(StockMovement::query(), $warehouseId)
            ->where('created_at', '>=', $now->copy()->startOfMonth()->subMonths($months - 1))
            ->whereIn('type', ['giris', 'cikis'])
            ->where('reason', '!=', 'sayim_duzeltme')
            ->get(['type', 'quantity', 'created_at']);

        // Transfers are excluded from both series — they move stock, not volume.
        foreach ($movements as $m) {
            $key = $m->created_at->year.'-'.$m->created_at->month;
            if (! isset($buckets[$key])) {
                continue;
            }
            if ($m->type === 'giris') {
                $buckets[$key]['inbound'] += (int) $m->quantity;
            } else {
                $buckets[$key]['outbound'] += (int) $m->quantity;
            }
        }

        return array_map(fn ($k) => $buckets[$k], $order);
    }

    public function categoryShares(?string $warehouseId): array
    {
        $categories = Category::query()->get();
        $productsByCategory = Product::query()->get(['id', 'category_id'])->groupBy('category_id');

        $unitsByProduct = DB::table('stock_levels')
            ->when($warehouseId, fn ($q) => $q->where('warehouse_id', $warehouseId))
            ->groupBy('product_id')
            ->select('product_id', DB::raw('COALESCE(SUM(quantity), 0) as units'))
            ->pluck('units', 'product_id');

        $shares = $categories->filter(fn ($c) => $c->parent_id === null)->map(function ($top) use ($categories, $productsByCategory, $unitsByProduct) {
            // The tree is two levels deep, so a top-level category plus its
            // direct children covers everything beneath it.
            $ids = collect([$top->id])->merge(
                $categories->filter(fn ($c) => $c->parent_id === $top->id)->pluck('id')
            );

            $units = $ids->sum(fn ($id) => $productsByCategory->get($id, collect())
                ->sum(fn ($p) => (int) ($unitsByProduct[$p->id] ?? 0)));

            return ['categoryId' => $top->id, 'name' => $top->name, 'units' => $units];
        })->sortByDesc('units')->values()->all();

        return $shares;
    }

    public function warehouseStockTotals(?string $warehouseId): array
    {
        $units = DB::table('stock_levels')
            ->groupBy('warehouse_id')
            ->select('warehouse_id', DB::raw('COALESCE(SUM(quantity), 0) as units'))
            ->pluck('units', 'warehouse_id');

        return Warehouse::query()
            ->when($warehouseId, fn ($q) => $q->whereKey($warehouseId))
            ->get()
            ->map(fn ($w) => [
                'warehouseId' => $w->id,
                'name' => $w->name,
                'units' => (int) ($units[$w->id] ?? 0),
                'capacity' => (int) $w->capacity,
            ])
            ->sortByDesc('units')
            ->values()
            ->all();
    }

    public function recentMovements(int $limit, ?string $warehouseId): array
    {
        $movements = $this->scopeToWarehouse(StockMovement::query(), $warehouseId)
            ->with(['product', 'warehouse', 'targetWarehouse', 'user'])
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        return $movements->map(fn ($m) => Present::movement($m) + [
            'productName' => $m->product->name ?? 'Bilinmeyen ürün',
            'productImageUrl' => $m->product->image_url ?? null,
            'warehouseName' => $m->warehouse->name ?? 'Bilinmeyen depo',
            'targetWarehouseName' => $m->targetWarehouse->name ?? null,
            'userName' => $m->user->name ?? 'Bilinmeyen kullanıcı',
        ])->all();
    }

    public function topMovers(int $limit, ?string $warehouseId): array
    {
        $aggregates = $this->scopeToWarehouse(StockMovement::query(), $warehouseId)
            ->groupBy('product_id')
            ->select([
                'product_id',
                DB::raw('COUNT(*) as movement_count'),
                DB::raw('COALESCE(SUM(quantity), 0) as total_quantity'),
            ])
            ->orderByDesc('total_quantity')
            ->limit($limit)
            ->get();

        $products = Product::query()->whereIn('id', $aggregates->pluck('product_id'))->get()->keyBy('id');

        return $aggregates->map(function ($row) use ($products) {
            $p = $products->get($row->product_id);
            if (! $p) {
                return null;
            }

            return [
                'productId' => $row->product_id,
                'name' => $p->name,
                'sku' => $p->sku,
                'movementCount' => (int) $row->movement_count,
                'totalQuantity' => (int) $row->total_quantity,
                'imageUrl' => $p->image_url,
            ];
        })->filter()->values()->all();
    }
}
