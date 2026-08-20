<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Support\Present;
use App\Support\TextTools;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Direct port of frontend/lib/api/categories.ts — see that file for the rules this mirrors. */
class CategoryController extends Controller
{
    private function normalize(string $value): string
    {
        return TextTools::normalize(trim($value));
    }

    /**
     * Per-category units/value/critical counts, aggregated in SQL rather than
     * per-row in PHP (the JSON version scanned every stock level per category).
     *
     * @return array<string, array{productCount:int,totalUnits:int,totalValue:float,criticalCount:int}>
     */
    private function metricsByCategory(): array
    {
        $rows = DB::table('products')
            ->leftJoin('stock_levels', 'stock_levels.product_id', '=', 'products.id')
            ->groupBy('products.id', 'products.category_id', 'products.purchase_price', 'products.min_stock')
            ->select([
                'products.category_id',
                'products.purchase_price',
                'products.min_stock',
                DB::raw('COALESCE(SUM(stock_levels.quantity), 0) as units'),
            ])
            ->get();

        $metrics = [];
        foreach ($rows as $row) {
            $key = $row->category_id;
            $metrics[$key] ??= ['productCount' => 0, 'totalUnits' => 0, 'totalValue' => 0.0, 'criticalCount' => 0];
            $units = (int) $row->units;
            $metrics[$key]['productCount']++;
            $metrics[$key]['totalUnits'] += $units;
            $metrics[$key]['totalValue'] += $units * (float) $row->purchase_price;
            if ($units < (int) $row->min_stock) {
                $metrics[$key]['criticalCount']++;
            }
        }

        return $metrics;
    }

    private function toNode(Category $category, array $metrics): array
    {
        $own = $metrics[$category->id] ?? ['productCount' => 0, 'totalUnits' => 0, 'totalValue' => 0.0, 'criticalCount' => 0];

        return Present::category($category) + $own + ['children' => []];
    }

    public function tree(Request $request)
    {
        $categories = Category::query()
            ->when($request->query('trashed') === '1', fn($q) => $q->onlyTrashed())
            ->get();
        $metrics = $this->metricsByCategory();
        $search = $request->query('search');

        $roots = $categories->filter(fn ($c) => $c->parent_id === null)
            ->map(fn ($c) => $this->toNode($c, $metrics))
            ->values()
            ->all();
        usort($roots, fn ($a, $b) => TextTools::compare($a['name'], $b['name']));

        foreach ($roots as &$root) {
            $children = $categories->filter(fn ($c) => $c->parent_id === $root['id'])
                ->map(fn ($c) => $this->toNode($c, $metrics))
                ->values()
                ->all();
            usort($children, fn ($a, $b) => TextTools::compare($a['name'], $b['name']));
            $root['children'] = $children;

            // Child metrics roll up into the parent, matching the frontend tree.
            foreach ($children as $child) {
                $root['productCount'] += $child['productCount'];
                $root['totalUnits'] += $child['totalUnits'];
                $root['totalValue'] += $child['totalValue'];
                $root['criticalCount'] += $child['criticalCount'];
            }
        }
        unset($root);

        $rootCount = count($roots);
        $childCount = $categories->count() - $rootCount;
        $criticalCategoryCount = 0;
        foreach ($roots as $r) {
            if ($r['criticalCount'] > 0) {
                $criticalCategoryCount++;
            }
            $criticalCategoryCount += count(array_filter($r['children'], fn ($c) => $c['criticalCount'] > 0));
        }

        // Stats describe the whole catalog; only `tree` is narrowed by search.
        $tree = $roots;
        if ($search) {
            $tree = [];
            foreach ($roots as $root) {
                if (TextTools::matches([$root['name']], $search)) {
                    $tree[] = $root;
                    continue;
                }
                $children = array_values(array_filter($root['children'], fn ($c) => TextTools::matches([$c['name']], $search)));
                if (count($children) > 0) {
                    $root['children'] = $children;
                    $tree[] = $root;
                }
            }
        }

        return response()->json([
            'tree' => $tree,
            'all' => $categories->map(fn ($c) => Present::category($c))->all(),
            'stats' => [
                'total' => $categories->count(),
                'rootCount' => $rootCount,
                'childCount' => $childCount,
                'criticalCategoryCount' => $criticalCategoryCount,
            ],
        ]);
    }

    private function buildId(string $name): string
    {
        $slug = TextTools::normalize(trim($name));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
        $slug = trim($slug, '-');
        $base = 'cat-'.($slug !== '' ? $slug : 'kategori');

        if (! Category::query()->whereKey($base)->exists()) {
            return $base;
        }
        $suffix = 2;
        while (Category::query()->whereKey("{$base}-{$suffix}")->exists()) {
            $suffix++;
        }

        return "{$base}-{$suffix}";
    }

    private function assertValidPlacement(string $name, ?string $parentId, ?string $ignoreId = null): void
    {
        if (trim($name) === '') {
            throw ApiException::validation('Kategori adı gereklidir.');
        }

        if ($parentId !== null) {
            $parent = Category::query()->find($parentId);
            if (! $parent) {
                throw ApiException::notFound('Üst kategori bulunamadı.');
            }
            if ($parent->parent_id !== null) {
                throw ApiException::validation('Alt kategorinin altına kategori eklenemez (en fazla 2 seviye).');
            }
        }

        // Sibling names must be unique, compared with Turkish-folded normalization.
        $duplicate = Category::query()
            ->when($parentId === null, fn ($q) => $q->whereNull('parent_id'), fn ($q) => $q->where('parent_id', $parentId))
            ->when($ignoreId !== null, fn ($q) => $q->whereKeyNot($ignoreId))
            ->get()
            ->contains(fn ($c) => $this->normalize($c->name) === $this->normalize($name));

        if ($duplicate) {
            throw ApiException::conflict($parentId === null
                ? 'Bu isimde bir üst kategori zaten var.'
                : 'Bu üst kategori altında aynı isimde bir alt kategori zaten var.');
        }
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'parentId' => ['nullable', 'string'],
        ]);
        $parentId = $data['parentId'] ?? null;

        $created = DB::transaction(function () use ($data, $parentId) {
            $this->assertValidPlacement($data['name'], $parentId);

            return Category::query()->create([
                'id' => $this->buildId($data['name']),
                'name' => trim($data['name']),
                'parent_id' => $parentId,
            ]);
        });

        return response()->json(Present::category($created), 201);
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'parentId' => ['nullable', 'string'],
        ]);
        $parentId = $data['parentId'] ?? null;

        $category = DB::transaction(function () use ($data, $parentId, $id) {
            $category = Category::query()->lockForUpdate()->find($id);
            if (! $category) {
                throw ApiException::notFound('Kategori bulunamadı.');
            }

            if ($parentId === $id) {
                throw ApiException::validation('Bir kategori kendi alt kategorisi olamaz.');
            }

            $hasChildren = Category::query()->where('parent_id', $id)->exists();
            if ($hasChildren && $parentId !== null) {
                throw ApiException::validation('Alt kategorileri olan bir kategori başka kategorinin altına taşınamaz.');
            }

            $this->assertValidPlacement($data['name'], $parentId, $id);

            $category->update(['name' => trim($data['name']), 'parent_id' => $parentId]);

            return $category;
        });

        return response()->json(Present::category($category));
    }

    public function destroy(Request $request, string $id)
    {
        DB::transaction(function () use ($request, $id) {
            $category = Category::query()->lockForUpdate()->find($id);
            if (! $category) {
                throw ApiException::notFound('Kategori bulunamadı.');
            }

            $childCount = Category::query()->where('parent_id', $id)->count();
            if ($childCount > 0) {
                throw ApiException::conflict("Bu kategorinin {$childCount} alt kategorisi olduğu için silinemez. Önce alt kategorileri silin.");
            }

            $productCount = Product::query()->where('category_id', $id)->count();
            if ($productCount > 0) {
                throw ApiException::conflict("Bu kategoriye bağlı {$productCount} ürün olduğu için silinemez. Önce ürünleri başka bir kategoriye taşıyın.");
            }

            $category->deleteAs($request->user()->getKey());
        });

        return response()->json(['deleted' => true]);
    }

    public function restore(string $id)
    {
        $model = \App\Models\Category::withTrashed()->find($id);
        if (!$model) {
            throw \App\Exceptions\ApiException::notFound('Kayıt bulunamadı.');
        }
        $model->restoreTracked();
        return response()->json(['restored' => true]);
    }
}
