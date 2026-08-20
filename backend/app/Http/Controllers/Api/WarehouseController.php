<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\Warehouse;
use App\Support\IdGenerator;
use App\Support\Present;
use App\Support\TextTools;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Direct port of frontend/lib/api/{warehouses,catalog}.ts's warehouse functions. */
class WarehouseController extends Controller
{
    /**
     * units + distinct-product counts per warehouse, in one grouped query.
     *
     * @return array<string, array{units:int, productCount:int}>
     */
    private function levelTotals(): array
    {
        $rows = DB::table('stock_levels')
            ->groupBy('warehouse_id')
            ->select([
                'warehouse_id',
                DB::raw('COALESCE(SUM(quantity), 0) as units'),
                DB::raw('COUNT(DISTINCT product_id) as product_count'),
                DB::raw('COUNT(DISTINCT CASE WHEN quantity > 0 THEN product_id END) as stocked_product_count'),
            ])
            ->get();

        $totals = [];
        foreach ($rows as $row) {
            $totals[$row->warehouse_id] = [
                'units' => (int) $row->units,
                'productCount' => (int) $row->product_count,
                'stockedProductCount' => (int) $row->stocked_product_count,
            ];
        }

        return $totals;
    }

    public function index(Request $request)
    {
        $totals = $this->levelTotals();

        $rows = Warehouse::query()->when($request->query('trashed') === '1', fn($q) => $q->onlyTrashed())->get()->map(fn ($w) => Present::warehouse($w) + [
            'units' => $totals[$w->id]['units'] ?? 0,
            'productCount' => $totals[$w->id]['productCount'] ?? 0,
        ])->all();

        return response()->json($rows);
    }

    public function detailed()
    {
        $totals = $this->levelTotals();

        // Inventory value per warehouse at purchase price, computed in SQL.
        $valueRows = DB::table('stock_levels')
            ->join('products', 'products.id', '=', 'stock_levels.product_id')
            ->groupBy('stock_levels.warehouse_id')
            ->select([
                'stock_levels.warehouse_id',
                DB::raw('COALESCE(SUM(stock_levels.quantity * products.purchase_price), 0) as total_value'),
            ])
            ->pluck('total_value', 'warehouse_id');

        $rows = Warehouse::query()->get()->map(function ($w) use ($totals, $valueRows) {
            $units = $totals[$w->id]['units'] ?? 0;
            $capacityUsagePercent = min((int) round(($units / max($w->capacity, 1)) * 100), 100);

            return Present::warehouse($w) + [
                'units' => $units,
                'totalValue' => (float) ($valueRows[$w->id] ?? 0),
                'productCount' => $totals[$w->id]['stockedProductCount'] ?? 0,
                'capacityUsagePercent' => $capacityUsagePercent,
            ];
        })->all();

        return response()->json($rows);
    }

    public function show(string $id)
    {
        $warehouse = Warehouse::query()->find($id);
        if (! $warehouse) {
            throw ApiException::notFound('Depo bulunamadı.');
        }

        $levels = StockLevel::query()
            ->with('product')
            ->where('warehouse_id', $id)
            ->get()
            ->filter(fn ($l) => $l->product !== null)
            ->map(fn ($l) => Present::stockLevel($l) + ['product' => Present::product($l->product)])
            ->values()
            ->all();

        return response()->json(['warehouse' => Present::warehouse($warehouse), 'levels' => $levels]);
    }

    public function stockMatrix(Request $request)
    {
        $warehouses = Warehouse::query()->get();
        $categoriesById = Category::query()->get()->keyBy('id');

        $query = Product::query();

        // Category filter walks descendants (2-level tree, so one hop is enough,
        // but the loop keeps it correct if the depth limit ever changes).
        $categoryId = $request->query('categoryId');
        if ($categoryId && $categoryId !== 'all') {
            $ids = [$categoryId => true];
            $added = true;
            while ($added) {
                $added = false;
                foreach ($categoriesById as $c) {
                    if ($c->parent_id && isset($ids[$c->parent_id]) && ! isset($ids[$c->id])) {
                        $ids[$c->id] = true;
                        $added = true;
                    }
                }
            }
            $query->whereIn('category_id', array_keys($ids));
        }

        $products = $query->get();

        $search = $request->query('search');
        if ($search) {
            $products = $products->filter(fn ($p) => TextTools::matches([$p->name, $p->sku, $p->brand], $search))->values();
        }

        $levelIndex = [];
        foreach (DB::table('stock_levels')->select('product_id', 'warehouse_id', 'quantity')->get() as $s) {
            $levelIndex[$s->product_id][$s->warehouse_id] = (int) $s->quantity;
        }

        $rows = $products->map(function ($p) use ($warehouses, $levelIndex, $categoriesById) {
            $stocksByWarehouse = [];
            $totalStock = 0;
            foreach ($warehouses as $w) {
                $q = $levelIndex[$p->id][$w->id] ?? 0;
                $stocksByWarehouse[$w->id] = $q;
                $totalStock += $q;
            }
            $category = $categoriesById->get($p->category_id);
            $unitPrice = (float) $p->purchase_price;

            return [
                'productId' => $p->id,
                'productName' => $p->name,
                'sku' => $p->sku,
                'categoryName' => $category->name ?? 'Genel',
                'brand' => $p->brand,
                'minStock' => (int) $p->min_stock,
                'unitPrice' => $unitPrice,
                'totalStock' => $totalStock,
                'totalValue' => $totalStock * $unitPrice,
                'isCritical' => $totalStock < (int) $p->min_stock,
                'status' => $p->status,
                'imageUrl' => $p->image_url,
                'stocksByWarehouse' => $stocksByWarehouse,
            ];
        })->all();

        $warehouseId = $request->query('warehouseId');
        if ($warehouseId && $warehouseId !== 'all') {
            $rows = array_values(array_filter($rows, fn ($r) => ($r['stocksByWarehouse'][$warehouseId] ?? 0) > 0));
        }

        return response()->json(array_values($rows));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'city' => ['required', 'string'],
            'address' => ['nullable', 'string'],
            'capacity' => ['required', 'numeric'],
        ]);

        if (trim($data['name']) === '') {
            throw ApiException::validation('Depo adı gereklidir.');
        }
        if (trim($data['city']) === '') {
            throw ApiException::validation('Şehir gereklidir.');
        }
        if ($data['capacity'] <= 0) {
            throw ApiException::validation("Kapasite 0'dan büyük olmalıdır.");
        }

        $warehouse = DB::transaction(fn () => Warehouse::query()->create([
            'id' => IdGenerator::nextId('warehouses', 'id', 'wh'),
            'name' => trim($data['name']),
            'city' => trim($data['city']),
            'address' => trim($data['address'] ?? '') ?: '-',
            'capacity' => (int) $data['capacity'],
        ]));

        return response()->json(Present::warehouse($warehouse), 201);
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'city' => ['sometimes', 'string'],
            'address' => ['sometimes', 'string'],
            'capacity' => ['sometimes', 'numeric'],
        ]);

        $warehouse = DB::transaction(function () use ($data, $id) {
            $warehouse = Warehouse::query()->lockForUpdate()->find($id);
            if (! $warehouse) {
                throw ApiException::notFound('Depo bulunamadı.');
            }

            foreach (['name' => 'name', 'city' => 'city', 'address' => 'address'] as $input => $column) {
                if (array_key_exists($input, $data)) {
                    $warehouse->{$column} = trim($data[$input]);
                }
            }
            if (array_key_exists('capacity', $data) && $data['capacity'] > 0) {
                $warehouse->capacity = (int) $data['capacity'];
            }
            $warehouse->save();

            return $warehouse;
        });

        return response()->json(Present::warehouse($warehouse));
    }

    public function destroy(Request $request, string $id)
    {
        DB::transaction(function () use ($request, $id) {
            $warehouse = Warehouse::query()->lockForUpdate()->find($id);
            if (! $warehouse) {
                throw ApiException::notFound('Depo bulunamadı.');
            }

            $hasStock = StockLevel::query()->where('warehouse_id', $id)->where('quantity', '>', 0)->exists();
            if ($hasStock) {
                throw ApiException::validation('Bu depoda henüz stok bulunduğu için silinemez. Önce stokları başka depoya transfer ediniz.');
            }

            // Empty levels can go; movements keep their FK and would block the delete.
            StockLevel::query()->where('warehouse_id', $id)->delete();
            $warehouse->deleteAs($request->user()->getKey());
        });

        return response()->json(['deleted' => true]);
    }

    public function restore(string $id)
    {
        $model = \App\Models\Warehouse::withTrashed()->find($id);
        if (!$model) {
            throw \App\Exceptions\ApiException::notFound('Kayıt bulunamadı.');
        }
        $model->restoreTracked();
        return response()->json(['restored' => true]);
    }
}
