<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Support\JsonStore;
use App\Support\TextTools;
use Illuminate\Http\Request;

/** Direct PHP port of frontend/lib/api/{warehouses,catalog}.ts's warehouse functions. */
class WarehouseController extends Controller
{
    public function __construct(private JsonStore $store)
    {
    }

    /** units-per-warehouse, mirrors lib/mock/dashboard.ts's getWarehouseStockTotals */
    private function unitTotals(array $stockLevels): array
    {
        $totals = [];
        foreach ($stockLevels as $s) {
            $totals[$s['warehouseId']] = ($totals[$s['warehouseId']] ?? 0) + $s['quantity'];
        }

        return $totals;
    }

    public function index()
    {
        $warehouses = $this->store->read('warehouses');
        $stockLevels = $this->store->read('stock_levels');
        $units = $this->unitTotals($stockLevels);

        $rows = array_map(function ($w) use ($stockLevels, $units) {
            $productIds = array_unique(array_column(array_filter($stockLevels, fn ($s) => $s['warehouseId'] === $w['id']), 'productId'));

            return $w + [
                'units' => $units[$w['id']] ?? 0,
                'productCount' => count($productIds),
            ];
        }, $warehouses);

        return response()->json($rows);
    }

    public function detailed()
    {
        $warehouses = $this->store->read('warehouses');
        $stockLevels = $this->store->read('stock_levels');
        $products = $this->store->read('products');
        $units = $this->unitTotals($stockLevels);
        $productsById = collect($products)->keyBy('id');

        $rows = array_map(function ($w) use ($stockLevels, $units, $productsById) {
            $warehouseLevels = array_values(array_filter($stockLevels, fn ($s) => $s['warehouseId'] === $w['id']));
            $totalValue = array_sum(array_map(function ($level) use ($productsById) {
                $p = $productsById->get($level['productId']);

                return $p ? $level['quantity'] * $p['purchasePrice'] : 0;
            }, $warehouseLevels));
            $productCount = count(array_unique(array_column(array_filter($warehouseLevels, fn ($s) => $s['quantity'] > 0), 'productId')));
            $unitsForWarehouse = $units[$w['id']] ?? 0;
            $capacityUsagePercent = min((int) round(($unitsForWarehouse / max($w['capacity'], 1)) * 100), 100);

            return $w + [
                'units' => $unitsForWarehouse,
                'totalValue' => $totalValue,
                'productCount' => $productCount,
                'capacityUsagePercent' => $capacityUsagePercent,
            ];
        }, $warehouses);

        return response()->json($rows);
    }

    public function show(string $id)
    {
        $warehouses = $this->store->read('warehouses');
        $wh = collect($warehouses)->firstWhere('id', $id);
        if (! $wh) {
            throw ApiException::notFound('Depo bulunamadı.');
        }

        $products = collect($this->store->read('products'))->keyBy('id');
        $levels = collect($this->store->read('stock_levels'))
            ->filter(fn ($s) => $s['warehouseId'] === $id)
            ->map(fn ($s) => $s + ['product' => $products->get($s['productId'])])
            ->filter(fn ($s) => $s['product'] !== null)
            ->values();

        return response()->json(['warehouse' => $wh, 'levels' => $levels]);
    }

    public function stockMatrix(Request $request)
    {
        $categories = $this->store->read('categories');
        $products = $this->store->read('products');
        $warehouses = $this->store->read('warehouses');
        $stockLevels = $this->store->read('stock_levels');
        $categoriesById = collect($categories)->keyBy('id');

        $categoryId = $request->query('categoryId');
        $filtered = $products;

        if ($categoryId && $categoryId !== 'all') {
            $ids = [$categoryId => true];
            $added = true;
            while ($added) {
                $added = false;
                foreach ($categories as $c) {
                    if ($c['parentId'] && isset($ids[$c['parentId']]) && ! isset($ids[$c['id']])) {
                        $ids[$c['id']] = true;
                        $added = true;
                    }
                }
            }
            $filtered = array_values(array_filter($filtered, fn ($p) => isset($ids[$p['categoryId']])));
        }

        $search = $request->query('search');
        if ($search) {
            $filtered = array_values(array_filter($filtered, fn ($p) => TextTools::matches([$p['name'], $p['sku'], $p['brand']], $search)));
        }

        $levelIndex = [];
        foreach ($stockLevels as $s) {
            $levelIndex[$s['productId']][$s['warehouseId']] = $s['quantity'];
        }

        $rows = array_map(function ($p) use ($warehouses, $levelIndex, $categoriesById) {
            $stocksByWarehouse = [];
            $totalStock = 0;
            foreach ($warehouses as $w) {
                $q = $levelIndex[$p['id']][$w['id']] ?? 0;
                $stocksByWarehouse[$w['id']] = $q;
                $totalStock += $q;
            }
            $category = $categoriesById->get($p['categoryId']);

            return [
                'productId' => $p['id'],
                'productName' => $p['name'],
                'sku' => $p['sku'],
                'categoryName' => $category['name'] ?? 'Genel',
                'brand' => $p['brand'],
                'minStock' => $p['minStock'],
                'unitPrice' => $p['purchasePrice'],
                'totalStock' => $totalStock,
                'totalValue' => $totalStock * $p['purchasePrice'],
                'isCritical' => $totalStock < $p['minStock'],
                'status' => $p['status'],
                'imageUrl' => $p['imageUrl'] ?? null,
                'stocksByWarehouse' => $stocksByWarehouse,
            ];
        }, $filtered);

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

        return $this->store->transaction(function () use ($data) {
            $warehouses = $this->store->read('warehouses');
            $newWh = [
                'id' => 'wh-'.(count($warehouses) + 1),
                'name' => trim($data['name']),
                'city' => trim($data['city']),
                'address' => trim($data['address'] ?? '') ?: '-',
                'capacity' => $data['capacity'],
            ];
            $warehouses[] = $newWh;
            $this->store->write('warehouses', $warehouses);

            return response()->json($newWh, 201);
        });
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'city' => ['sometimes', 'string'],
            'address' => ['sometimes', 'string'],
            'capacity' => ['sometimes', 'numeric'],
        ]);

        return $this->store->transaction(function () use ($data, $id) {
            $warehouses = $this->store->read('warehouses');
            $index = collect($warehouses)->search(fn ($w) => $w['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Depo bulunamadı.');
            }

            if (array_key_exists('name', $data)) {
                $warehouses[$index]['name'] = trim($data['name']);
            }
            if (array_key_exists('city', $data)) {
                $warehouses[$index]['city'] = trim($data['city']);
            }
            if (array_key_exists('address', $data)) {
                $warehouses[$index]['address'] = trim($data['address']);
            }
            if (array_key_exists('capacity', $data) && $data['capacity'] > 0) {
                $warehouses[$index]['capacity'] = $data['capacity'];
            }

            $this->store->write('warehouses', $warehouses);

            return response()->json($warehouses[$index]);
        });
    }

    public function destroy(string $id)
    {
        return $this->store->transaction(function () use ($id) {
            $warehouses = $this->store->read('warehouses');
            $index = collect($warehouses)->search(fn ($w) => $w['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Depo bulunamadı.');
            }

            $hasStock = collect($this->store->read('stock_levels'))->contains(fn ($s) => $s['warehouseId'] === $id && $s['quantity'] > 0);
            if ($hasStock) {
                throw ApiException::validation('Bu depoda henüz stok bulunduğu için silinemez. Önce stokları başka depoya transfer ediniz.');
            }

            unset($warehouses[$index]);
            $this->store->write('warehouses', array_values($warehouses));

            return response()->json(['deleted' => true]);
        });
    }
}
