<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Supplier;
use App\Support\IdGenerator;
use App\Support\Present;
use App\Support\TextTools;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Direct port of frontend/lib/api/catalog.ts's supplier functions. */
class SupplierController extends Controller
{
    public function index(Request $request)
    {
        $productCounts = DB::table('products')
            ->groupBy('supplier_id')
            ->select('supplier_id', DB::raw('COUNT(*) as c'))
            ->pluck('c', 'supplier_id');

        $rows = Supplier::query()->when($request->query('trashed') === '1', fn($q) => $q->onlyTrashed())->get()
            ->map(fn ($s) => Present::supplier($s) + ['productCount' => (int) ($productCounts[$s->id] ?? 0)])
            ->all();

        $search = $request->query('search');
        $rows = array_values(array_filter(
            $rows,
            fn ($s) => TextTools::matches([$s['name'], $s['contactName'], $s['email'], $s['city']], $search)
        ));

        $page = (int) $request->query('page', 1);
        $pageSize = (int) $request->query('pageSize', 10);

        return response()->json(TextTools::paginate($rows, $page, $pageSize));
    }

    public function show(string $id)
    {
        $supplier = Supplier::query()->find($id);
        if (! $supplier) {
            throw ApiException::notFound('Tedarikçi bulunamadı.');
        }

        $products = Product::query()->where('supplier_id', $id)->get()
            ->map(fn ($p) => Present::product($p))->all();

        return response()->json(['supplier' => Present::supplier($supplier), 'products' => $products]);
    }

    private function assertValid(array $data): void
    {
        if (trim($data['name']) === '') {
            throw ApiException::validation('Tedarikçi adı gereklidir.');
        }
        if (trim($data['contactName']) === '') {
            throw ApiException::validation('Yetkili adı gereklidir.');
        }
        if (! str_contains(trim($data['email']), '@')) {
            throw ApiException::validation('Geçerli bir e-posta gereklidir.');
        }
        if (trim($data['phone']) === '') {
            throw ApiException::validation('Telefon gereklidir.');
        }
        if (trim($data['city']) === '') {
            throw ApiException::validation('Şehir gereklidir.');
        }
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'contactName' => ['required', 'string'],
            'email' => ['required', 'string'],
            'phone' => ['required', 'string'],
            'city' => ['required', 'string'],
        ]);

        $this->assertValid($data);

        $supplier = DB::transaction(fn () => Supplier::query()->create([
            'id' => IdGenerator::nextId('suppliers', 'id', 'sup'),
            'name' => trim($data['name']),
            'contact_name' => trim($data['contactName']),
            'email' => trim($data['email']),
            'phone' => trim($data['phone']),
            'city' => trim($data['city']),
        ]));

        return response()->json(Present::supplier($supplier), 201);
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'contactName' => ['sometimes', 'string'],
            'email' => ['sometimes', 'string'],
            'phone' => ['sometimes', 'string'],
            'city' => ['sometimes', 'string'],
        ]);

        $supplier = DB::transaction(function () use ($data, $id) {
            $supplier = Supplier::query()->lockForUpdate()->find($id);
            if (! $supplier) {
                throw ApiException::notFound('Tedarikçi bulunamadı.');
            }

            $columns = [
                'name' => 'name',
                'contactName' => 'contact_name',
                'email' => 'email',
                'phone' => 'phone',
                'city' => 'city',
            ];
            foreach ($columns as $input => $column) {
                if (array_key_exists($input, $data)) {
                    $supplier->{$column} = trim($data[$input]);
                }
            }
            $supplier->save();

            return $supplier;
        });

        return response()->json(Present::supplier($supplier));
    }

    public function destroy(Request $request, string $id)
    {
        DB::transaction(function () use ($request, $id) {
            $supplier = Supplier::query()->lockForUpdate()->find($id);
            if (! $supplier) {
                throw ApiException::notFound('Tedarikçi bulunamadı.');
            }

            $hasProducts = Product::query()->where('supplier_id', $id)->exists();
            if ($hasProducts) {
                throw ApiException::validation('Bu tedarikçiye bağlı ürünler olduğu için silinemez. Önce ürünlerin tedarikçisini değiştiriniz.');
            }

            $supplier->deleteAs($request->user()->getKey());
        });

        return response()->json(['deleted' => true]);
    }

    public function restore(string $id)
    {
        $model = \App\Models\Supplier::withTrashed()->find($id);
        if (!$model) {
            throw \App\Exceptions\ApiException::notFound('Kayıt bulunamadı.');
        }
        $model->restoreTracked();
        return response()->json(['restored' => true]);
    }
}
