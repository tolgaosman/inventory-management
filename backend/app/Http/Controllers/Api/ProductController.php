<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Support\InventoryCalc;
use App\Support\JsonStore;
use App\Support\Labels;
use App\Support\TextTools;
use Illuminate\Http\Request;

/** Direct PHP port of frontend/lib/api/products.ts. */
class ProductController extends Controller
{
    public function __construct(private JsonStore $store)
    {
    }

    private function toRow(array $p, array $categoriesById, array $totalsByProduct): array
    {
        $totalStock = $totalsByProduct[$p['id']] ?? 0;

        return $p + [
            'totalStock' => $totalStock,
            'categoryName' => $categoriesById[$p['categoryId']]['name'] ?? '-',
            'critical' => InventoryCalc::isCritical($p, $totalStock),
        ];
    }

    private function categoryAndDescendantIds(array $categories, string $catId): array
    {
        $ids = [$catId => true];
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

        return $ids;
    }

    private function computeStats(array $rows): array
    {
        $mult = config('inventory.low_stock_multiplier');

        return [
            'total' => count($rows),
            'critical' => count(array_filter($rows, fn ($p) => $p['critical'])),
            'low' => count(array_filter($rows, fn ($p) => ! $p['critical'] && $p['totalStock'] < $p['minStock'] * $mult)),
            'overstock' => count(array_filter($rows, fn ($p) => $p['totalStock'] > $p['maxStock'])),
            'passive' => count(array_filter($rows, fn ($p) => $p['status'] === 'pasif')),
            'stockValue' => array_sum(array_map(fn ($p) => ($p['warehouseStock'] ?? $p['totalStock']) * $p['purchasePrice'], $rows)),
        ];
    }

    public function index(Request $request)
    {
        $products = $this->store->read('products');
        $categories = $this->store->read('categories');
        $stockLevels = $this->store->read('stock_levels');
        $categoriesById = collect($categories)->keyBy('id')->all();
        $totalsByProduct = InventoryCalc::totalsByProduct($stockLevels);

        $rows = array_map(fn ($p) => $this->toRow($p, $categoriesById, $totalsByProduct), $products);

        $search = $request->query('search');
        $rows = array_values(array_filter($rows, fn ($p) => TextTools::matches([$p['name'], $p['sku'], $p['barcode'], $p['brand'], $p['categoryName']], $search)));

        if ($catId = $request->query('categoryId')) {
            $allowed = $this->categoryAndDescendantIds($categories, $catId);
            $rows = array_values(array_filter($rows, fn ($p) => isset($allowed[$p['categoryId']])));
        }
        if ($supplierId = $request->query('supplierId')) {
            $rows = array_values(array_filter($rows, fn ($p) => $p['supplierId'] === $supplierId));
        }
        if ($warehouseId = $request->query('warehouseId')) {
            $byWarehouse = InventoryCalc::totalsByProductInWarehouse($stockLevels, $warehouseId);
            $rows = array_values(array_filter(array_map(function ($p) use ($byWarehouse) {
                $q = $byWarehouse[$p['id']] ?? 0;
                if ($q > 0) {
                    $p['warehouseStock'] = $q;

                    return $p;
                }

                return null;
            }, $rows), fn ($p) => $p !== null));
        }

        $mult = config('inventory.low_stock_multiplier');
        $stockStatus = $request->query('stockStatus');
        if ($stockStatus === 'kritik') {
            $rows = array_values(array_filter($rows, fn ($p) => $p['critical']));
        } elseif ($stockStatus === 'dusuk') {
            $rows = array_values(array_filter($rows, fn ($p) => ! $p['critical'] && $p['totalStock'] < $p['minStock'] * $mult));
        } elseif ($stockStatus === 'normal') {
            $rows = array_values(array_filter($rows, fn ($p) => $p['totalStock'] >= $p['minStock'] * $mult));
        } elseif ($stockStatus === 'fazla') {
            $rows = array_values(array_filter($rows, fn ($p) => $p['totalStock'] > $p['maxStock']));
        }

        if ($status = $request->query('status')) {
            $rows = array_values(array_filter($rows, fn ($p) => $p['status'] === $status));
        }
        if ($request->filled('minPrice')) {
            $min = (float) $request->query('minPrice');
            $rows = array_values(array_filter($rows, fn ($p) => $p['salePrice'] >= $min));
        }
        if ($request->filled('maxPrice')) {
            $max = (float) $request->query('maxPrice');
            $rows = array_values(array_filter($rows, fn ($p) => $p['salePrice'] <= $max));
        }

        $stats = $this->computeStats($rows);

        if ($sortBy = $request->query('sortBy')) {
            $dir = $request->query('sortDir') === 'desc' ? -1 : 1;
            usort($rows, function ($a, $b) use ($sortBy, $dir) {
                $av = $a[$sortBy] ?? null;
                $bv = $b[$sortBy] ?? null;
                if (is_numeric($av) && is_numeric($bv)) {
                    return ($av <=> $bv) * $dir;
                }

                return TextTools::compare((string) $av, (string) $bv) * $dir;
            });
        }

        $page = (int) $request->query('page', 1);
        $pageSize = (int) $request->query('pageSize', 10);
        $paged = TextTools::paginate($rows, $page, $pageSize);
        $paged['stats'] = $stats;

        return response()->json($paged);
    }

    public function show(string $id)
    {
        $product = collect($this->store->read('products'))->firstWhere('id', $id);
        if (! $product) {
            throw ApiException::notFound('Ürün bulunamadı.');
        }
        $categoriesById = collect($this->store->read('categories'))->keyBy('id')->all();
        $totals = InventoryCalc::totalsByProduct($this->store->read('stock_levels'));

        return response()->json($this->toRow($product, $categoriesById, $totals));
    }

    public function stockByWarehouse(string $id)
    {
        $levels = array_values(array_filter($this->store->read('stock_levels'), fn ($s) => $s['productId'] === $id));

        return response()->json($levels);
    }

    public function history(string $id)
    {
        $movements = array_values(array_filter($this->store->read('stock_movements'), fn ($m) => $m['productId'] === $id));
        $warehousesById = collect($this->store->read('warehouses'))->keyBy('id')->all();
        $usersById = collect($this->store->read('users'))->keyBy('id')->all();

        $entries = array_map(fn ($m) => [
            'id' => $m['id'],
            'date' => $m['createdAt'],
            'delta' => $m['type'] === 'giris' ? $m['quantity'] : -$m['quantity'],
            'type' => $m['type'],
            'warehouseName' => $warehousesById[$m['warehouseId']]['name'] ?? '-',
            'targetWarehouseName' => $m['type'] === 'transfer' ? ($warehousesById[$m['targetWarehouseId']]['name'] ?? null) : null,
            'reasonLabel' => Labels::movementReason($m['reason']),
            'userName' => $usersById[$m['userId']]['name'] ?? '-',
            'note' => $m['note'] ?? null,
            'previousQuantity' => $m['previousQuantity'],
            'newQuantity' => $m['newQuantity'],
        ], $movements);

        return response()->json($entries);
    }

    private function validateProductInput(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string'],
            'sku' => ['required', 'string'],
            'barcode' => ['required', 'string'],
            'categoryId' => ['required', 'string'],
            'brand' => ['required', 'string'],
            'unit' => ['required', 'string'],
            'purchasePrice' => ['required', 'numeric'],
            'salePrice' => ['required', 'numeric'],
            'minStock' => ['required', 'integer'],
            'maxStock' => ['required', 'integer'],
            'supplierId' => ['required', 'string'],
            'imageUrl' => ['nullable', 'string'],
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateProductInput($request);

        return $this->store->transaction(function () use ($data) {
            $products = $this->store->read('products');
            if (collect($products)->contains(fn ($p) => mb_strtolower($p['sku']) === mb_strtolower($data['sku']))) {
                throw ApiException::conflict("\"{$data['sku']}\" SKU'su zaten kullanılıyor.");
            }

            $product = $data + ['id' => $this->store->nextId($products, 'prd'), 'status' => 'aktif'];
            $products[] = $product;
            $this->store->write('products', $products);

            $categoriesById = collect($this->store->read('categories'))->keyBy('id')->all();
            $totals = InventoryCalc::totalsByProduct($this->store->read('stock_levels'));

            return response()->json($this->toRow($product, $categoriesById, $totals), 201);
        });
    }

    public function update(Request $request, string $id)
    {
        $data = $this->validateProductInput($request);

        return $this->store->transaction(function () use ($data, $id) {
            $products = $this->store->read('products');
            $index = collect($products)->search(fn ($p) => $p['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Ürün bulunamadı.');
            }
            if (collect($products)->contains(fn ($p) => $p['id'] !== $id && mb_strtolower($p['sku']) === mb_strtolower($data['sku']))) {
                throw ApiException::conflict("\"{$data['sku']}\" SKU'su zaten kullanılıyor.");
            }

            $products[$index] = $data + ['id' => $id, 'status' => $products[$index]['status']];
            $this->store->write('products', $products);

            $categoriesById = collect($this->store->read('categories'))->keyBy('id')->all();
            $totals = InventoryCalc::totalsByProduct($this->store->read('stock_levels'));

            return response()->json($this->toRow($products[$index], $categoriesById, $totals));
        });
    }

    public function toggleStatus(string $id)
    {
        return $this->store->transaction(function () use ($id) {
            $products = $this->store->read('products');
            $index = collect($products)->search(fn ($p) => $p['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Ürün bulunamadı.');
            }

            $products[$index]['status'] = $products[$index]['status'] === 'aktif' ? 'pasif' : 'aktif';
            $this->store->write('products', $products);

            $categoriesById = collect($this->store->read('categories'))->keyBy('id')->all();
            $totals = InventoryCalc::totalsByProduct($this->store->read('stock_levels'));

            return response()->json($this->toRow($products[$index], $categoriesById, $totals));
        });
    }

    public function destroy(string $id)
    {
        return $this->store->transaction(function () use ($id) {
            $products = $this->store->read('products');
            $index = collect($products)->search(fn ($p) => $p['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Ürün bulunamadı.');
            }
            if (collect($this->store->read('stock_movements'))->contains(fn ($m) => $m['productId'] === $id)) {
                throw ApiException::conflict('Bu ürüne ait stok hareketi olduğu için silinemez.');
            }

            unset($products[$index]);
            $this->store->write('products', array_values($products));

            return response()->json(null, 204);
        });
    }

    public function bulkStatus(Request $request)
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['string'],
            'status' => ['required', 'in:aktif,pasif'],
        ]);

        return $this->store->transaction(function () use ($data) {
            $products = $this->store->read('products');
            $count = 0;
            foreach ($products as &$p) {
                if (in_array($p['id'], $data['ids'], true)) {
                    $p['status'] = $data['status'];
                    $count++;
                }
            }
            unset($p);
            $this->store->write('products', $products);

            return response()->json(['updatedCount' => $count]);
        });
    }

    public function bulkDelete(Request $request)
    {
        $data = $request->validate(['ids' => ['required', 'array'], 'ids.*' => ['string']]);

        return $this->store->transaction(function () use ($data) {
            $products = $this->store->read('products');
            $movements = $this->store->read('stock_movements');
            $deletedCount = 0;
            $failedSkus = [];

            foreach ($data['ids'] as $id) {
                $index = collect($products)->search(fn ($p) => $p['id'] === $id);
                if ($index === false) {
                    continue;
                }
                if (collect($movements)->contains(fn ($m) => $m['productId'] === $id)) {
                    $failedSkus[] = $products[$index]['sku'];
                } else {
                    unset($products[$index]);
                    $deletedCount++;
                }
            }

            $this->store->write('products', array_values($products));

            return response()->json(['deletedCount' => $deletedCount, 'failedSkus' => $failedSkus]);
        });
    }

    public function bulkImport(Request $request)
    {
        $data = $request->validate(['inputs' => ['required', 'array']]);

        return $this->store->transaction(function () use ($data) {
            $products = $this->store->read('products');
            $importedCount = 0;
            $errors = [];

            foreach ($data['inputs'] as $input) {
                if (collect($products)->contains(fn ($p) => mb_strtolower($p['sku']) === mb_strtolower($input['sku'] ?? ''))) {
                    $errors[] = "\"{$input['sku']}\" SKU'su zaten mevcut, atlandı.";
                    continue;
                }
                $product = $input + ['id' => $this->store->nextId($products, 'prd'), 'status' => 'aktif'];
                $products[] = $product;
                $importedCount++;
            }

            $this->store->write('products', $products);

            return response()->json(['importedCount' => $importedCount, 'errors' => $errors]);
        });
    }
}
