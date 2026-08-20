<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\StockMovement;
use App\Services\StockService;
use App\Support\Present;
use App\Support\TextTools;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Direct port of frontend/lib/api/movements.ts. */
class MovementController extends Controller
{
    public function __construct(private StockService $stock)
    {
    }

    /**
     * Shared filter set behind both `index()` and `summary()`. `$includeType`
     * is off for the tab-count query in `summary()`, which needs everything
     * *except* type filtered so it can group the remainder by type.
     */
    private function applyFilters($query, Request $request, bool $includeType = true)
    {
        if ($includeType && ($type = $request->query('type'))) {
            $query->where('type', $type);
        }
        if ($reason = $request->query('reason')) {
            $query->where('reason', $reason);
        }
        if ($productId = $request->query('productId')) {
            $query->where('product_id', $productId);
        }
        // A warehouse's history includes transfers arriving from elsewhere.
        if ($warehouseId = $request->query('warehouseId')) {
            $query->where(fn ($q) => $q->where('warehouse_id', $warehouseId)->orWhere('target_warehouse_id', $warehouseId));
        }
        if ($userId = $request->query('userId')) {
            $query->where('user_id', $userId);
        }
        if ($dateFrom = $request->query('dateFrom')) {
            $query->where('created_at', '>=', $dateFrom);
        }
        if ($dateTo = $request->query('dateTo')) {
            $query->where('created_at', '<=', $dateTo);
        }

        // Product name/SKU search needs Turkish diacritic folding, which SQLite
        // can't do in LIKE — resolve matching product ids first, then filter.
        if ($search = $request->query('search')) {
            $productIds = \App\Models\Product::query()
                ->get(['id', 'name', 'sku'])
                ->filter(fn ($p) => TextTools::matches([$p->name, $p->sku], $search))
                ->pluck('id')
                ->all();
            $query->whereIn('product_id', $productIds);
        }

        return $query;
    }

    public function index(Request $request)
    {
        $query = $this->applyFilters(
            StockMovement::query()
                ->with('user')
                ->when($request->query('trashed') === '1', fn ($q) => $q->onlyTrashed())
                ->orderByDesc('created_at')
                ->orderByDesc('id'),
            $request,
        );

        $total = (clone $query)->count();
        $page = max((int) $request->query('page', 1), 1);
        $pageSize = max((int) $request->query('pageSize', 10), 1);

        $rows = $query->forPage($page, $pageSize)->get()->map(fn ($m) => Present::movement($m))->all();

        return response()->json([
            'rows' => $rows,
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
        ]);
    }

    /**
     * Aggregate counts for the movement-history page's tab badges and hero
     * card — replaces what used to be 6 separate `listMovements()` calls
     * fetched into the browser just to read `.total` off each, with 2 real
     * SQL aggregate queries. Tab counts respect the caller's active filters
     * (minus `type`, since that's what's being broken down); the "today"/fire
     * hero numbers are always global, matching the previous hero behavior.
     */
    public function summary(Request $request)
    {
        $typeCounts = $this->applyFilters(StockMovement::query(), $request, includeType: false)
            ->selectRaw('type, COUNT(*) as cnt')
            ->groupBy('type')
            ->pluck('cnt', 'type');

        $todayFrom = now()->startOfDay();
        $todayTo = now()->endOfDay();

        $todayIn = StockMovement::query()->where('type', 'giris')->whereBetween('created_at', [$todayFrom, $todayTo])->count();
        $todayOut = StockMovement::query()->where('type', 'cikis')->whereBetween('created_at', [$todayFrom, $todayTo])->count();
        $fireCount = StockMovement::query()->where('reason', 'fire')->count();

        return response()->json([
            'typeCounts' => [
                'giris' => (int) ($typeCounts['giris'] ?? 0),
                'cikis' => (int) ($typeCounts['cikis'] ?? 0),
                'transfer' => (int) ($typeCounts['transfer'] ?? 0),
            ],
            'todayIn' => $todayIn,
            'todayOut' => $todayOut,
            'fireCount' => $fireCount,
        ]);
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
        // Never trust a client-sent userId — it comes from the token.
        $data['userId'] = $request->user()->getKey();

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
        $data['userId'] = $request->user()->getKey();

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
        $data['userId'] = $request->user()->getKey();

        return response()->json($this->stock->transfer($data), 201);
    }

    public function quantity(Request $request)
    {
        $data = $request->validate([
            'productId' => ['required', 'string'],
            'warehouseId' => ['required', 'string'],
        ]);

        return response()->json(['quantity' => $this->stock->quantity($data['productId'], $data['warehouseId'])]);
    }

    /**
     * "Deleting" a movement means cancelling it: its stock effect is reversed
     * (giriş removed, çıkış put back, transfer reversed both sides) before the
     * row itself is soft-deleted.
     */
    public function destroy(Request $request, string $id)
    {
        DB::transaction(function () use ($request, $id) {
            $movement = StockMovement::query()->lockForUpdate()->find($id);
            if (! $movement) {
                throw ApiException::notFound('Hareket bulunamadı.');
            }

            if ($movement->purchase_order_id) {
                throw ApiException::conflict('Satın alma siparişi ile oluşturulan stok hareketleri buradan silinemez.');
            }

            $this->stock->reverseMovement($movement);
            $movement->deleteAs($request->user()->getKey());
        });

        return response()->json(['deleted' => true]);
    }

    /** Restoring a cancelled movement re-applies its original stock effect. */
    public function restore(Request $request, string $id)
    {
        DB::transaction(function () use ($request, $id) {
            $movement = StockMovement::withTrashed()->lockForUpdate()->find($id);
            if (! $movement) {
                throw ApiException::notFound('Kayıt bulunamadı.');
            }

            if ($movement->purchase_order_id) {
                throw ApiException::conflict('Satın alma siparişi ile oluşturulan stok hareketleri buradan geri yüklenemez.');
            }

            $this->stock->reapplyMovement($movement);
            $movement->restoreTracked();
        });

        return response()->json(['restored' => true]);
    }
}
