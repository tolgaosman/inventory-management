<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\Warehouse;
use App\Support\IdGenerator;
use App\Support\Labels;
use App\Support\Present;
use App\Support\TextTools;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Direct port of frontend/lib/api/products.ts. */
class ProductController extends Controller
{
    /** @return array<string,int> productId => total units across all warehouses */
    private function totalsByProduct(): array
    {
        return DB::table('stock_levels')
            ->groupBy('product_id')
            ->select('product_id', DB::raw('COALESCE(SUM(quantity), 0) as units'))
            ->pluck('units', 'product_id')
            ->map(fn ($v) => (int) $v)
            ->all();
    }

    private function toRow(Product $p, array $categoryNames, array $totals): array
    {
        $totalStock = $totals[$p->id] ?? 0;

        return Present::product($p) + [
            'totalStock' => $totalStock,
            'categoryName' => $categoryNames[$p->category_id] ?? '-',
            'critical' => $totalStock < (int) $p->min_stock,
        ];
    }

    private function categoryNames(): array
    {
        return Category::query()->pluck('name', 'id')->all();
    }

    /** Every descendant of a category, so filtering a parent includes its children. */
    private function categoryAndDescendantIds(string $catId): array
    {
        $categories = Category::query()->get(['id', 'parent_id']);
        $ids = [$catId => true];
        $added = true;
        while ($added) {
            $added = false;
            foreach ($categories as $c) {
                if ($c->parent_id && isset($ids[$c->parent_id]) && ! isset($ids[$c->id])) {
                    $ids[$c->id] = true;
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
            'critical' => count(array_filter($rows, fn ($p) => $p['critical'] && $p['totalStock'] > 0)),
            'low' => count(array_filter($rows, fn ($p) => ! $p['critical'] && $p['totalStock'] > 0 && $p['totalStock'] < $p['minStock'] * $mult)),
            'overstock' => count(array_filter($rows, fn ($p) => $p['totalStock'] > $p['maxStock'])),
            'passive' => count(array_filter($rows, fn ($p) => $p['status'] === 'pasif')),
            'stockValue' => array_sum(array_map(fn ($p) => ($p['warehouseStock'] ?? $p['totalStock']) * $p['purchasePrice'], $rows)),
        ];
    }

    public function index(Request $request)
    {
        $totals = $this->totalsByProduct();
        $categoryNames = $this->categoryNames();

        $query = Product::query()
            ->when($request->query('trashed') === '1', fn($q) => $q->onlyTrashed());

        if ($catId = $request->query('categoryId')) {
            $query->whereIn('category_id', array_keys($this->categoryAndDescendantIds($catId)));
        }
        if ($supplierId = $request->query('supplierId')) {
            $query->where('supplier_id', $supplierId);
        }
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($request->filled('minPrice')) {
            $query->where('sale_price', '>=', (float) $request->query('minPrice'));
        }
        if ($request->filled('maxPrice')) {
            $query->where('sale_price', '<=', (float) $request->query('maxPrice'));
        }

        $rows = $query->get()->map(fn ($p) => $this->toRow($p, $categoryNames, $totals))->all();

        // Turkish-folded search runs in PHP; SQLite LIKE can't fold ı/İ/ğ/ü/ş/ö/ç.
        $search = $request->query('search');
        if ($search) {
            $rows = array_values(array_filter(
                $rows,
                fn ($p) => TextTools::matches([$p['name'], $p['sku'], $p['barcode'], $p['brand'], $p['categoryName']], $search)
            ));
        }

        // Warehouse filter narrows to products actually stocked there, but
        // totalStock stays global — the UI shows both numbers.
        if ($warehouseId = $request->query('warehouseId')) {
            $byWarehouse = DB::table('stock_levels')
                ->where('warehouse_id', $warehouseId)
                ->pluck('quantity', 'product_id');

            $rows = array_values(array_filter(array_map(function ($p) use ($byWarehouse) {
                $q = (int) ($byWarehouse[$p['id']] ?? 0);
                if ($q > 0) {
                    $p['warehouseStock'] = $q;

                    return $p;
                }

                return null;
            }, $rows), fn ($p) => $p !== null));
        }

        $mult = config('inventory.low_stock_multiplier');
        $stockStatus = $request->query('stockStatus');
        if ($stockStatus === 'yok') {
            $rows = array_values(array_filter($rows, fn ($p) => $p['totalStock'] <= 0));
        } elseif ($stockStatus === 'kritik') {
            $rows = array_values(array_filter($rows, fn ($p) => $p['critical'] && $p['totalStock'] > 0));
        } elseif ($stockStatus === 'dusuk') {
            $rows = array_values(array_filter($rows, fn ($p) => ! $p['critical'] && $p['totalStock'] > 0 && $p['totalStock'] < $p['minStock'] * $mult));
        } elseif ($stockStatus === 'normal') {
            // Bands are mutually exclusive: "normal" stops where "fazla" starts.
            $rows = array_values(array_filter(
                $rows,
                fn ($p) => $p['totalStock'] >= $p['minStock'] * $mult && $p['totalStock'] <= $p['maxStock']
            ));
        } elseif ($stockStatus === 'fazla') {
            $rows = array_values(array_filter($rows, fn ($p) => $p['totalStock'] > $p['maxStock']));
        }

        // Stats describe the filtered — but not yet paginated — set.
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

    private function findOrFail(string $id): Product
    {
        $product = Product::query()->find($id);
        if (! $product) {
            throw ApiException::notFound('Ürün bulunamadı.');
        }

        return $product;
    }

    public function show(string $id)
    {
        $product = $this->findOrFail($id);

        return response()->json($this->toRow($product, $this->categoryNames(), $this->totalsByProduct()));
    }

    public function stockByWarehouse(string $id)
    {
        $levels = StockLevel::query()->where('product_id', $id)->get()
            ->map(fn ($l) => Present::stockLevel($l))->all();

        return response()->json($levels);
    }

    public function history(string $id)
    {
        $warehouseNames = Warehouse::query()->pluck('name', 'id');
        $userNames = \App\Models\User::query()->pluck('name', 'id');

        $entries = StockMovement::query()
            ->where('product_id', $id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'date' => Present::date($m->created_at),
                'delta' => $m->type === 'giris' ? (int) $m->quantity : -(int) $m->quantity,
                'type' => $m->type,
                'warehouseName' => $warehouseNames[$m->warehouse_id] ?? '-',
                'targetWarehouseName' => $m->type === 'transfer' ? ($warehouseNames[$m->target_warehouse_id] ?? null) : null,
                'reasonLabel' => Labels::movementReason($m->reason),
                'userName' => $userNames[$m->user_id] ?? '-',
                'note' => $m->note,
                'previousQuantity' => (int) $m->previous_quantity,
                'newQuantity' => (int) $m->new_quantity,
            ])
            ->all();

        return response()->json($entries);
    }

    /** @return array<string,mixed> snake_case attributes ready for the model */
    private function validateProductInput(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'sku' => ['required', 'string'],
            'barcode' => ['required', 'string'],
            'categoryId' => ['required', 'string', 'exists:categories,id'],
            'brand' => ['required', 'string'],
            'unit' => ['required', 'string'],
            'purchasePrice' => ['required', 'numeric', 'min:0'],
            'salePrice' => ['required', 'numeric', 'min:0'],
            'minStock' => ['required', 'integer', 'min:0'],
            'maxStock' => ['required', 'integer', 'min:0'],
            'supplierId' => ['required', 'string', 'exists:suppliers,id'],
            'imageUrl' => ['nullable', 'string'],
        ]);

        return [
            'name' => $data['name'],
            'sku' => $data['sku'],
            'barcode' => $data['barcode'],
            'category_id' => $data['categoryId'],
            'brand' => $data['brand'],
            'unit' => $data['unit'],
            'purchase_price' => $data['purchasePrice'],
            'sale_price' => $data['salePrice'],
            'min_stock' => $data['minStock'],
            'max_stock' => $data['maxStock'],
            'supplier_id' => $data['supplierId'],
            'image_url' => $data['imageUrl'] ?? null,
        ];
    }

    private function assertSkuFree(string $sku, ?string $ignoreId = null): void
    {
        $taken = Product::query()
            ->whereRaw('lower(sku) = ?', [mb_strtolower($sku)])
            ->when($ignoreId !== null, fn ($q) => $q->whereKeyNot($ignoreId))
            ->exists();

        if ($taken) {
            throw ApiException::conflict("\"{$sku}\" SKU'su zaten kullanılıyor.");
        }
    }

    public function store(Request $request)
    {
        $attributes = $this->validateProductInput($request);

        $product = DB::transaction(function () use ($attributes) {
            $this->assertSkuFree($attributes['sku']);

            return Product::query()->create($attributes + [
                'id' => IdGenerator::nextId('products', 'id', 'prd', 4),
                'status' => 'aktif',
            ]);
        });

        return response()->json($this->toRow($product, $this->categoryNames(), $this->totalsByProduct()), 201);
    }

    public function update(Request $request, string $id)
    {
        $attributes = $this->validateProductInput($request);

        $product = DB::transaction(function () use ($attributes, $id) {
            $product = Product::query()->lockForUpdate()->find($id);
            if (! $product) {
                throw ApiException::notFound('Ürün bulunamadı.');
            }
            $this->assertSkuFree($attributes['sku'], $id);

            $product->update($attributes);

            return $product;
        });

        return response()->json($this->toRow($product, $this->categoryNames(), $this->totalsByProduct()));
    }

    public function toggleStatus(string $id)
    {
        $product = DB::transaction(function () use ($id) {
            $product = Product::query()->lockForUpdate()->find($id);
            if (! $product) {
                throw ApiException::notFound('Ürün bulunamadı.');
            }
            $product->status = $product->status === 'aktif' ? 'pasif' : 'aktif';
            $product->save();

            return $product;
        });

        return response()->json($this->toRow($product, $this->categoryNames(), $this->totalsByProduct()));
    }

    public function destroy(Request $request, string $id)
    {
        DB::transaction(function () use ($request, $id) {
            $product = Product::query()->lockForUpdate()->find($id);
            if (! $product) {
                throw ApiException::notFound('Ürün bulunamadı.');
            }
            if (StockMovement::query()->where('product_id', $id)->exists()) {
                throw ApiException::conflict('Bu ürüne ait stok hareketi olduğu için silinemez.');
            }

            StockLevel::query()->where('product_id', $id)->delete();
            $product->deleteAs($request->user()->getKey());
        });

        return response()->json(null, 204);
    }

    public function bulkStatus(Request $request)
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['string'],
            'status' => ['required', 'in:aktif,pasif'],
        ]);

        $count = DB::transaction(fn () => Product::query()->whereIn('id', $data['ids'])->update(['status' => $data['status']]));

        return response()->json(['updatedCount' => $count]);
    }

    public function bulkDelete(Request $request)
    {
        $data = $request->validate(['ids' => ['required', 'array'], 'ids.*' => ['string']]);
        $userId = $request->user()->getKey();

        return response()->json(DB::transaction(function () use ($data, $userId) {
            $deletedCount = 0;
            $failedSkus = [];

            // Partial success by design: one blocked product doesn't abort the rest.
            foreach ($data['ids'] as $id) {
                $product = Product::query()->lockForUpdate()->find($id);
                if (! $product) {
                    continue;
                }
                if (StockMovement::query()->where('product_id', $id)->exists()) {
                    $failedSkus[] = $product->sku;

                    continue;
                }
                StockLevel::query()->where('product_id', $id)->delete();
                $product->deleteAs($userId);
                $deletedCount++;
            }

            return ['deletedCount' => $deletedCount, 'failedSkus' => $failedSkus];
        }));
    }

    public function bulkImport(Request $request)
    {
        $data = $request->validate([
            'inputs' => ['required', 'array'],
            // Per-row validation: the JSON version accepted arbitrary keys and
            // wrote malformed rows that later blew up in the stats calculation.
            'inputs.*.name' => ['required', 'string'],
            'inputs.*.sku' => ['required', 'string'],
            'inputs.*.barcode' => ['required', 'string'],
            'inputs.*.categoryId' => ['required', 'string'],
            'inputs.*.brand' => ['required', 'string'],
            'inputs.*.unit' => ['required', 'string'],
            'inputs.*.purchasePrice' => ['required', 'numeric', 'min:0'],
            'inputs.*.salePrice' => ['required', 'numeric', 'min:0'],
            'inputs.*.minStock' => ['required', 'integer', 'min:0'],
            'inputs.*.maxStock' => ['required', 'integer', 'min:0'],
            'inputs.*.supplierId' => ['required', 'string'],
            'inputs.*.imageUrl' => ['nullable', 'string'],
        ]);

        return response()->json(DB::transaction(function () use ($data) {
            $importedCount = 0;
            $errors = [];
            $categoryIds = Category::query()->pluck('id')->flip();
            $supplierIds = Supplier::query()->pluck('id')->flip();

            foreach ($data['inputs'] as $input) {
                $sku = $input['sku'];

                if (Product::query()->whereRaw('lower(sku) = ?', [mb_strtolower($sku)])->exists()) {
                    $errors[] = "\"{$sku}\" SKU'su zaten mevcut, atlandı.";

                    continue;
                }
                if (! $categoryIds->has($input['categoryId'])) {
                    $errors[] = "\"{$sku}\": kategori bulunamadı, atlandı.";

                    continue;
                }
                if (! $supplierIds->has($input['supplierId'])) {
                    $errors[] = "\"{$sku}\": tedarikçi bulunamadı, atlandı.";

                    continue;
                }

                Product::query()->create([
                    'id' => IdGenerator::nextId('products', 'id', 'prd', 4),
                    'status' => 'aktif',
                    'name' => $input['name'],
                    'sku' => $sku,
                    'barcode' => $input['barcode'],
                    'category_id' => $input['categoryId'],
                    'brand' => $input['brand'],
                    'unit' => $input['unit'],
                    'purchase_price' => $input['purchasePrice'],
                    'sale_price' => $input['salePrice'],
                    'min_stock' => $input['minStock'],
                    'max_stock' => $input['maxStock'],
                    'supplier_id' => $input['supplierId'],
                    'image_url' => $input['imageUrl'] ?? null,
                ]);
                $importedCount++;
            }

            return ['importedCount' => $importedCount, 'errors' => $errors];
        }));
    }

    public function restore(string $id)
    {
        $model = \App\Models\Product::withTrashed()->find($id);
        if (!$model) {
            throw \App\Exceptions\ApiException::notFound('Kayıt bulunamadı.');
        }
        $model->restoreTracked();
        return response()->json(['restored' => true]);
    }
}
