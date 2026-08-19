<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Services\PurchaseOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Direct port of frontend/lib/api/purchase-orders.ts's replenishment engine. */
class ReplenishmentController extends Controller
{
    public function __construct(private PurchaseOrderService $service)
    {
    }

    public function suggestions()
    {
        $totals = DB::table('stock_levels')
            ->groupBy('product_id')
            ->select('product_id', DB::raw('COALESCE(SUM(quantity), 0) as units'))
            ->pluck('units', 'product_id');

        $onOrderMap = [];
        $draftOnOrderMap = [];
        foreach (PurchaseOrder::query()->with('items')->get() as $po) {
            foreach ($po->items as $item) {
                if (in_array($po->status, ['ordered', 'partially_received'], true)) {
                    $outstanding = (int) $item->quantity - (int) $item->received_quantity;
                    $onOrderMap[$item->product_id] = ($onOrderMap[$item->product_id] ?? 0) + $outstanding;
                } elseif (in_array($po->status, ['draft', 'pending_approval'], true)) {
                    // Tracked separately and deliberately NOT counted as coverage —
                    // nothing is actually on its way until the order is sent.
                    $draftOnOrderMap[$item->product_id] = ($draftOnOrderMap[$item->product_id] ?? 0) + (int) $item->quantity;
                }
            }
        }

        $mult = config('inventory.low_stock_multiplier');
        $suggestions = [];

        foreach (Product::query()->with('supplier')->where('status', 'aktif')->get() as $product) {
            $totalStock = (int) ($totals[$product->id] ?? 0);
            $onOrder = $onOrderMap[$product->id] ?? 0;
            $projected = $totalStock + $onOrder;
            if ($projected >= (int) $product->min_stock * $mult) {
                continue;
            }
            $suggestedQty = max((int) $product->max_stock - $projected, 0);
            if ($suggestedQty <= 0) {
                continue;
            }

            $suggestions[] = [
                'productId' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'unit' => $product->unit,
                'imageUrl' => $product->image_url,
                'supplierId' => $product->supplier_id,
                'supplierName' => $product->supplier->name ?? '-',
                'totalStock' => $totalStock,
                'minStock' => (int) $product->min_stock,
                'maxStock' => (int) $product->max_stock,
                'onOrder' => $onOrder,
                'draftOnOrder' => $draftOnOrderMap[$product->id] ?? 0,
                'projected' => $projected,
                'shortfall' => max((int) $product->min_stock - $projected, 0),
                'suggestedQty' => $suggestedQty,
                'unitPrice' => (float) $product->purchase_price,
                'severity' => $projected < (int) $product->min_stock ? 'kritik' : 'dusuk',
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

        $products = Product::query()
            ->whereIn('id', collect($data['lines'])->pluck('productId'))
            ->get()
            ->keyBy('id');

        // One draft order per supplier — a single reorder run can span many.
        $bySupplier = [];
        foreach ($data['lines'] as $line) {
            if ($line['quantity'] <= 0) {
                continue;
            }
            $product = $products->get($line['productId']);
            if (! $product) {
                continue;
            }
            $bySupplier[$product->supplier_id][] = [
                'productId' => $product->id,
                'quantity' => $line['quantity'],
                'unitPrice' => (float) $product->purchase_price,
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
