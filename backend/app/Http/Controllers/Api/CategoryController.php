<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Support\JsonStore;
use App\Support\TextTools;
use Illuminate\Http\Request;

/** Direct PHP port of frontend/lib/api/categories.ts — see that file for the rules this mirrors. */
class CategoryController extends Controller
{
    public function __construct(private JsonStore $store)
    {
    }

    private function normalize(string $value): string
    {
        return TextTools::normalize(trim($value));
    }

    private function ownMetrics(string $categoryId, array $products, array $stockLevels): array
    {
        $own = array_values(array_filter($products, fn ($p) => $p['categoryId'] === $categoryId));
        $totalUnits = 0;
        $totalValue = 0;
        $criticalCount = 0;

        foreach ($own as $p) {
            $units = array_sum(array_map(fn ($s) => $s['quantity'], array_filter($stockLevels, fn ($s) => $s['productId'] === $p['id'])));
            $totalUnits += $units;
            $totalValue += $units * $p['purchasePrice'];
            if ($units < $p['minStock']) {
                $criticalCount++;
            }
        }

        return ['productCount' => count($own), 'totalUnits' => $totalUnits, 'totalValue' => $totalValue, 'criticalCount' => $criticalCount];
    }

    private function toNode(array $category, array $products, array $stockLevels): array
    {
        return $category + $this->ownMetrics($category['id'], $products, $stockLevels) + ['children' => []];
    }

    public function tree(Request $request)
    {
        $categories = $this->store->read('categories');
        $products = $this->store->read('products');
        $stockLevels = $this->store->read('stock_levels');
        $search = $request->query('search');

        $roots = array_values(array_filter($categories, fn ($c) => $c['parentId'] === null));
        $roots = array_map(fn ($c) => $this->toNode($c, $products, $stockLevels), $roots);
        usort($roots, fn ($a, $b) => TextTools::compare($a['name'], $b['name']));

        foreach ($roots as &$root) {
            $children = array_values(array_filter($categories, fn ($c) => $c['parentId'] === $root['id']));
            $children = array_map(fn ($c) => $this->toNode($c, $products, $stockLevels), $children);
            usort($children, fn ($a, $b) => TextTools::compare($a['name'], $b['name']));
            $root['children'] = $children;

            foreach ($children as $child) {
                $root['productCount'] += $child['productCount'];
                $root['totalUnits'] += $child['totalUnits'];
                $root['totalValue'] += $child['totalValue'];
                $root['criticalCount'] += $child['criticalCount'];
            }
        }
        unset($root);

        $rootCount = count($roots);
        $childCount = count($categories) - $rootCount;
        $criticalCategoryCount = 0;
        foreach ($roots as $r) {
            if ($r['criticalCount'] > 0) {
                $criticalCategoryCount++;
            }
            $criticalCategoryCount += count(array_filter($r['children'], fn ($c) => $c['criticalCount'] > 0));
        }

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
            'all' => $categories,
            'stats' => [
                'total' => count($categories),
                'rootCount' => $rootCount,
                'childCount' => $childCount,
                'criticalCategoryCount' => $criticalCategoryCount,
            ],
        ]);
    }

    private function buildId(string $name, array $categories): string
    {
        $slug = TextTools::normalize(trim($name));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
        $slug = trim($slug, '-');
        $base = 'cat-'.($slug !== '' ? $slug : 'kategori');

        $ids = array_column($categories, 'id');
        if (! in_array($base, $ids, true)) {
            return $base;
        }
        $suffix = 2;
        while (in_array("{$base}-{$suffix}", $ids, true)) {
            $suffix++;
        }

        return "{$base}-{$suffix}";
    }

    private function assertValidPlacement(array $categories, string $name, ?string $parentId, ?string $ignoreId = null): void
    {
        if (trim($name) === '') {
            throw ApiException::validation('Kategori adı gereklidir.');
        }

        if ($parentId !== null) {
            $parent = collect($categories)->firstWhere('id', $parentId);
            if (! $parent) {
                throw ApiException::notFound('Üst kategori bulunamadı.');
            }
            if ($parent['parentId'] !== null) {
                throw ApiException::validation('Alt kategorinin altına kategori eklenemez (en fazla 2 seviye).');
            }
        }

        $duplicate = collect($categories)->contains(
            fn ($c) => $c['id'] !== $ignoreId && $c['parentId'] === $parentId && $this->normalize($c['name']) === $this->normalize($name)
        );
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

        return $this->store->transaction(function () use ($data, $parentId) {
            $categories = $this->store->read('categories');
            $this->assertValidPlacement($categories, $data['name'], $parentId);

            $created = ['id' => $this->buildId($data['name'], $categories), 'name' => trim($data['name']), 'parentId' => $parentId];
            $categories[] = $created;
            $this->store->write('categories', $categories);

            return response()->json($created, 201);
        });
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'parentId' => ['nullable', 'string'],
        ]);
        $parentId = $data['parentId'] ?? null;

        return $this->store->transaction(function () use ($data, $parentId, $id) {
            $categories = $this->store->read('categories');
            $index = collect($categories)->search(fn ($c) => $c['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Kategori bulunamadı.');
            }

            if ($parentId === $id) {
                throw ApiException::validation('Bir kategori kendi alt kategorisi olamaz.');
            }

            $hasChildren = collect($categories)->contains(fn ($c) => $c['parentId'] === $id);
            if ($hasChildren && $parentId !== null) {
                throw ApiException::validation('Alt kategorileri olan bir kategori başka kategorinin altına taşınamaz.');
            }

            $this->assertValidPlacement($categories, $data['name'], $parentId, $id);

            $categories[$index]['name'] = trim($data['name']);
            $categories[$index]['parentId'] = $parentId;
            $this->store->write('categories', $categories);

            return response()->json($categories[$index]);
        });
    }

    public function destroy(string $id)
    {
        return $this->store->transaction(function () use ($id) {
            $categories = $this->store->read('categories');
            $index = collect($categories)->search(fn ($c) => $c['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Kategori bulunamadı.');
            }

            $childCount = collect($categories)->filter(fn ($c) => $c['parentId'] === $id)->count();
            if ($childCount > 0) {
                throw ApiException::conflict("Bu kategorinin {$childCount} alt kategorisi olduğu için silinemez. Önce alt kategorileri silin.");
            }

            $products = $this->store->read('products');
            $productCount = collect($products)->filter(fn ($p) => $p['categoryId'] === $id)->count();
            if ($productCount > 0) {
                throw ApiException::conflict("Bu kategoriye bağlı {$productCount} ürün olduğu için silinemez. Önce ürünleri başka bir kategoriye taşıyın.");
            }

            unset($categories[$index]);
            $this->store->write('categories', array_values($categories));

            return response()->json(['deleted' => true]);
        });
    }
}
