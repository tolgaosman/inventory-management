<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Services\PurchaseOrderService;
use App\Support\JsonStore;
use Illuminate\Http\Request;

/** Direct PHP port of frontend/lib/api/purchase-orders.ts's replenishment engine. */
class ReplenishmentController extends Controller
{
    public function __construct(private JsonStore $store, private PurchaseOrderService $service)
    {
    }

    public function suggestions()
    {
        $orders = $this->store->read('purchase_orders');
        $products = $this->store->read('products');
        $suppliersById = collect($this->store->read('suppliers'))->keyBy('id');
        $stockLevels = $this->store->read('stock_levels');
        $totals = \App\Support\InventoryCalc::totalsByProduct($stockLevels);

        $onOrderMap = [];
        $draftOnOrderMap = [];
        foreach ($orders as $po) {
            if (in_array($po['status'], ['ordered', 'partially_received'], true)) {
                foreach ($po['items'] as $item) {
                    $onOrderMap[$item['productId']] = ($onOrderMap[$item['productId']] ?? 0) + ($item['quantity'] - $item['receivedQuantity']);
                }
            } elseif ($po['status'] === 'draft') {
                foreach ($po['items'] as $item) {
                    $draftOnOrderMap[$item['productId']] = ($draftOnOrderMap[$item['productId']] ?? 0) + $item['quantity'];
                }
            }
        }

        $mult = config('inventory.low_stock_multiplier');
        $suggestions = [];

        foreach ($products as $product) {
            if ($product['status'] !== 'aktif') {
                continue;
            }
            $totalStock = $totals[$product['id']] ?? 0;
            $onOrder = $onOrderMap[$product['id']] ?? 0;
            $projected = $totalStock + $onOrder;
            if ($projected >= $product['minStock'] * $mult) {
                continue;
            }
            $suggestedQty = max($product['maxStock'] - $projected, 0);
            if ($suggestedQty <= 0) {
                continue;
            }

            $suggestions[] = [
                'productId' => $product['id'],
                'name' => $product['name'],
                'sku' => $product['sku'],
                'unit' => $product['unit'],
                'imageUrl' => $product['imageUrl'] ?? null,
                'supplierId' => $product['supplierId'],
                'supplierName' => $suppliersById->get($product['supplierId'])['name'] ?? '-',
                'totalStock' => $totalStock,
                'minStock' => $product['minStock'],
                'maxStock' => $product['maxStock'],
                'onOrder' => $onOrder,
                'draftOnOrder' => $draftOnOrderMap[$product['id']] ?? 0,
                'projected' => $projected,
                'shortfall' => max($product['minStock'] - $projected, 0),
                'suggestedQty' => $suggestedQty,
                'unitPrice' => $product['purchasePrice'],
                'severity' => $projected < $product['minStock'] ? 'kritik' : 'dusuk',
            ];
        }

        usort($suggestions, fn ($a, $b) => $b['shortfall'] <=> $a['shortfall']);

        return response()->json($suggestions);
    }

    public function createOrders(Request $request)
    {
        $data = $request->validate([
            'warehouseId' => ['required', 'string'],
            'expectedAt' => ['required', 'string'],
            'lines' => ['required', 'array'],
            'lines.*.productId' => ['required', 'string'],
            'lines.*.quantity' => ['required', 'numeric'],
        ]);

        $products = collect($this->store->read('products'))->keyBy('id');
        $bySupplier = [];
        foreach ($data['lines'] as $line) {
            if ($line['quantity'] <= 0) {
                continue;
            }
            $product = $products->get($line['productId']);
            if (! $product) {
                continue;
            }
            $bySupplier[$product['supplierId']][] = [
                'productId' => $product['id'],
                'quantity' => $line['quantity'],
                'unitPrice' => $product['purchasePrice'],
            ];
        }

        if (count($bySupplier) === 0) {
            throw ApiException::validation('Geçerli bir ürün/miktar bulunamadı.');
        }

        $created = [];
        foreach ($bySupplier as $supplierId => $items) {
            $created[] = $this->service->create([
                'supplierId' => $supplierId,
                'warehouseId' => $data['warehouseId'],
                'expectedAt' => $data['expectedAt'],
                'items' => $items,
            ]);
        }

        return response()->json($created, 201);
    }
}
