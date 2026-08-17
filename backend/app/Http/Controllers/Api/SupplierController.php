<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Support\JsonStore;
use App\Support\TextTools;
use Illuminate\Http\Request;

/** Direct PHP port of frontend/lib/api/catalog.ts's supplier functions. */
class SupplierController extends Controller
{
    public function __construct(private JsonStore $store)
    {
    }

    public function index(Request $request)
    {
        $suppliers = $this->store->read('suppliers');
        $products = $this->store->read('products');

        $rows = array_map(fn ($s) => $s + [
            'productCount' => count(array_filter($products, fn ($p) => $p['supplierId'] === $s['id'])),
        ], $suppliers);

        $search = $request->query('search');
        $rows = array_values(array_filter($rows, fn ($s) => TextTools::matches([$s['name'], $s['contactName'], $s['email'], $s['city']], $search)));

        $page = (int) $request->query('page', 1);
        $pageSize = (int) $request->query('pageSize', 10);

        return response()->json(TextTools::paginate($rows, $page, $pageSize));
    }

    public function show(string $id)
    {
        $supplier = collect($this->store->read('suppliers'))->firstWhere('id', $id);
        if (! $supplier) {
            throw ApiException::notFound('Tedarikçi bulunamadı.');
        }

        $products = array_values(array_filter($this->store->read('products'), fn ($p) => $p['supplierId'] === $id));

        return response()->json(['supplier' => $supplier, 'products' => $products]);
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

        return $this->store->transaction(function () use ($data) {
            $suppliers = $this->store->read('suppliers');
            $newSupplier = [
                'id' => 'sup-'.(count($suppliers) + 1),
                'name' => trim($data['name']),
                'contactName' => trim($data['contactName']),
                'email' => trim($data['email']),
                'phone' => trim($data['phone']),
                'city' => trim($data['city']),
            ];
            $suppliers[] = $newSupplier;
            $this->store->write('suppliers', $suppliers);

            return response()->json($newSupplier, 201);
        });
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

        return $this->store->transaction(function () use ($data, $id) {
            $suppliers = $this->store->read('suppliers');
            $index = collect($suppliers)->search(fn ($s) => $s['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Tedarikçi bulunamadı.');
            }

            foreach (['name', 'contactName', 'email', 'phone', 'city'] as $field) {
                if (array_key_exists($field, $data)) {
                    $suppliers[$index][$field] = trim($data[$field]);
                }
            }

            $this->store->write('suppliers', $suppliers);

            return response()->json($suppliers[$index]);
        });
    }

    public function destroy(string $id)
    {
        return $this->store->transaction(function () use ($id) {
            $suppliers = $this->store->read('suppliers');
            $index = collect($suppliers)->search(fn ($s) => $s['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Tedarikçi bulunamadı.');
            }

            $hasProducts = collect($this->store->read('products'))->contains(fn ($p) => $p['supplierId'] === $id);
            if ($hasProducts) {
                throw ApiException::validation('Bu tedarikçiye bağlı ürünler olduğu için silinemez. Önce ürünlerin tedarikçisini değiştiriniz.');
            }

            unset($suppliers[$index]);
            $this->store->write('suppliers', array_values($suppliers));

            return response()->json(['deleted' => true]);
        });
    }
}
