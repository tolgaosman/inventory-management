<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StockService;
use App\Support\JsonStore;
use App\Support\TextTools;
use Illuminate\Http\Request;

/** Direct PHP port of frontend/lib/api/movements.ts. */
class MovementController extends Controller
{
    public function __construct(private JsonStore $store, private StockService $stock)
    {
    }

    public function index(Request $request)
    {
        $rows = $this->store->read('stock_movements');
        $products = collect($this->store->read('products'))->keyBy('id');

        if ($type = $request->query('type')) {
            $rows = array_values(array_filter($rows, fn ($m) => $m['type'] === $type));
        }
        if ($reason = $request->query('reason')) {
            $rows = array_values(array_filter($rows, fn ($m) => $m['reason'] === $reason));
        }
        if ($productId = $request->query('productId')) {
            $rows = array_values(array_filter($rows, fn ($m) => $m['productId'] === $productId));
        }
        if ($warehouseId = $request->query('warehouseId')) {
            $rows = array_values(array_filter($rows, fn ($m) => $m['warehouseId'] === $warehouseId || $m['targetWarehouseId'] === $warehouseId));
        }
        if ($userId = $request->query('userId')) {
            $rows = array_values(array_filter($rows, fn ($m) => $m['userId'] === $userId));
        }
        if ($dateFrom = $request->query('dateFrom')) {
            $rows = array_values(array_filter($rows, fn ($m) => $m['createdAt'] >= $dateFrom));
        }
        if ($dateTo = $request->query('dateTo')) {
            $rows = array_values(array_filter($rows, fn ($m) => $m['createdAt'] <= $dateTo));
        }
        if ($search = $request->query('search')) {
            $rows = array_values(array_filter($rows, function ($m) use ($products, $search) {
                $p = $products->get($m['productId']);

                return TextTools::matches([$p['name'] ?? null, $p['sku'] ?? null], $search);
            }));
        }

        $page = (int) $request->query('page', 1);
        $pageSize = (int) $request->query('pageSize', 10);

        return response()->json(TextTools::paginate($rows, $page, $pageSize));
    }

    public function stockIn(Request $request)
    {
        $data = $request->validate([
            'warehouseId' => ['required', 'string'],
            'productId' => ['required', 'string'],
            'quantity' => ['required', 'numeric'],
            'supplierId' => ['nullable', 'string'],
            'purchaseOrderId' => ['nullable', 'string'],
            'note' => ['nullable', 'string'],
            'idempotencyKey' => ['nullable', 'string'],
        ]);
        $data['userId'] = $request->user('api-token')->id();

        return response()->json($this->stock->stockIn($data), 201);
    }

    public function stockOut(Request $request)
    {
        $data = $request->validate([
            'warehouseId' => ['required', 'string'],
            'productId' => ['required', 'string'],
            'quantity' => ['required', 'numeric'],
            'reason' => ['required', 'in:satis,fire,sayim_duzeltme'],
            'note' => ['nullable', 'string'],
            'idempotencyKey' => ['nullable', 'string'],
        ]);
        $data['userId'] = $request->user('api-token')->id();

        return response()->json($this->stock->stockOut($data), 201);
    }

    public function transfer(Request $request)
    {
        $data = $request->validate([
            'sourceWarehouseId' => ['required', 'string'],
            'targetWarehouseId' => ['required', 'string'],
            'productId' => ['required', 'string'],
            'quantity' => ['required', 'numeric'],
            'note' => ['nullable', 'string'],
            'idempotencyKey' => ['nullable', 'string'],
        ]);
        $data['userId'] = $request->user('api-token')->id();

        return response()->json($this->stock->transfer($data), 201);
    }

    public function quantity(Request $request)
    {
        $data = $request->validate(['productId' => ['required', 'string'], 'warehouseId' => ['required', 'string']]);

        return response()->json(['quantity' => $this->stock->quantity($data['productId'], $data['warehouseId'])]);
    }
}
