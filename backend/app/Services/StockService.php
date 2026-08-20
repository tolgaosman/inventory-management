<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\IdempotencyKey;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\Warehouse;
use App\Support\IdGenerator;
use App\Support\Present;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Port of frontend/lib/api/movements.ts's mutation functions.
 *
 * Every write runs inside DB::transaction with the affected stock_levels rows
 * held under lockForUpdate, and the sufficiency check now happens *inside* that
 * lock. The JSON-backed version validated before taking the lock, so two
 * concurrent çıkış requests could both pass the check and drive quantity
 * negative; that race is gone.
 */
class StockService
{
    /** Locks (creating if absent) the stock level for a product/warehouse pair. */
    private function lockLevel(string $productId, string $warehouseId): StockLevel
    {
        $level = StockLevel::query()
            ->where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->lockForUpdate()
            ->first();

        if ($level) {
            return $level;
        }

        return StockLevel::query()->create([
            'product_id' => $productId,
            'warehouse_id' => $warehouseId,
            'quantity' => 0,
        ]);
    }

    private function assertWarehouse(string $warehouseId): Warehouse
    {
        $warehouse = Warehouse::query()->find($warehouseId);
        if (! $warehouse) {
            throw ApiException::notFound('Depo bulunamadı.');
        }

        return $warehouse;
    }

    private function assertProduct(string $productId): Product
    {
        $product = Product::query()->find($productId);
        if (! $product) {
            throw ApiException::notFound('Ürün bulunamadı.');
        }

        return $product;
    }

    /**
     * Returns the movement created by the original request when the same
     * idempotency key is replayed, so a double-clicked submit never posts
     * stock twice. Persisted in a table (not an in-memory map like the mock),
     * so a retry after a restart still short-circuits.
     */
    private function withIdempotency(?string $key, callable $create): array
    {
        if ($key) {
            $existing = IdempotencyKey::query()->where('key', $key)->first();
            if ($existing) {
                $movement = StockMovement::query()->find($existing->movement_id);
                if ($movement) {
                    return Present::movement($movement);
                }
            }
        }

        $movement = $create();

        if ($key) {
            IdempotencyKey::query()->create(['key' => $key, 'movement_id' => $movement->id]);
        }

        return Present::movement($movement);
    }

    private function recordMovement(array $attributes): StockMovement
    {
        return StockMovement::query()->create($attributes + [
            'id' => IdGenerator::nextId('stock_movements', 'id', 'mv', 4),
            'created_at' => Carbon::now(),
        ]);
    }

    public function stockIn(array $input): array
    {
        if ($input['quantity'] <= 0) {
            throw ApiException::validation('Miktar sıfırdan büyük olmalı.');
        }
        $this->assertProduct($input['productId']);
        $this->assertWarehouse($input['warehouseId']);

        return DB::transaction(fn () => $this->withIdempotency($input['idempotencyKey'] ?? null, function () use ($input) {
            $level = $this->lockLevel($input['productId'], $input['warehouseId']);
            $previousQuantity = (int) $level->quantity;
            $newQuantity = $previousQuantity + (int) $input['quantity'];

            $level->quantity = $newQuantity;
            $level->save();

            return $this->recordMovement([
                'type' => 'giris',
                'product_id' => $input['productId'],
                'warehouse_id' => $input['warehouseId'],
                'target_warehouse_id' => null,
                'quantity' => (int) $input['quantity'],
                'previous_quantity' => $previousQuantity,
                'new_quantity' => $newQuantity,
                'reason' => $input['reason'] ?? 'satin_alma',
                'supplier_id' => $input['supplierId'] ?? null,
                'purchase_order_id' => $input['purchaseOrderId'] ?? null,
                'user_id' => $input['userId'],
                'note' => $input['note'] ?? null,
            ]);
        }));
    }

    public function stockOut(array $input): array
    {
        if ($input['quantity'] <= 0) {
            throw ApiException::validation('Miktar sıfırdan büyük olmalı.');
        }
        $this->assertProduct($input['productId']);
        $this->assertWarehouse($input['warehouseId']);

        return DB::transaction(fn () => $this->withIdempotency($input['idempotencyKey'] ?? null, function () use ($input) {
            $level = $this->lockLevel($input['productId'], $input['warehouseId']);
            $previousQuantity = (int) $level->quantity;

            // Checked under the row lock, so a concurrent çıkış cannot slip past.
            if ((int) $input['quantity'] > $previousQuantity) {
                throw ApiException::validation("Yetersiz stok: bu depoda {$previousQuantity} adet var, {$input['quantity']} adet çıkış istendi.");
            }

            $newQuantity = $previousQuantity - (int) $input['quantity'];
            $level->quantity = $newQuantity;
            $level->save();

            return $this->recordMovement([
                'type' => 'cikis',
                'product_id' => $input['productId'],
                'warehouse_id' => $input['warehouseId'],
                'target_warehouse_id' => null,
                'quantity' => (int) $input['quantity'],
                'previous_quantity' => $previousQuantity,
                'new_quantity' => $newQuantity,
                'reason' => $input['reason'],
                'supplier_id' => null,
                'purchase_order_id' => null,
                'user_id' => $input['userId'],
                'note' => $input['note'] ?? null,
            ]);
        }));
    }

    public function transfer(array $input): array
    {
        if ($input['sourceWarehouseId'] === $input['targetWarehouseId']) {
            throw ApiException::validation('Kaynak ve hedef depo aynı olamaz.');
        }
        if ($input['quantity'] <= 0) {
            throw ApiException::validation('Miktar sıfırdan büyük olmalı.');
        }

        $product = $this->assertProduct($input['productId']);
        if ($product->status === 'pasif') {
            throw ApiException::validation("\"{$product->name}\" pasif durumda olduğu için stok transferi yapılamaz.");
        }
        $source = $this->assertWarehouse($input['sourceWarehouseId']);
        $this->assertWarehouse($input['targetWarehouseId']);

        return DB::transaction(fn () => $this->withIdempotency($input['idempotencyKey'] ?? null, function () use ($input, $source) {
            // Lock in a stable order so two opposing transfers can't deadlock.
            [$firstId, $secondId] = $input['sourceWarehouseId'] < $input['targetWarehouseId']
                ? [$input['sourceWarehouseId'], $input['targetWarehouseId']]
                : [$input['targetWarehouseId'], $input['sourceWarehouseId']];
            $this->lockLevel($input['productId'], $firstId);
            $this->lockLevel($input['productId'], $secondId);

            $sourceLevel = $this->lockLevel($input['productId'], $input['sourceWarehouseId']);
            $previousQuantity = (int) $sourceLevel->quantity;

            if ((int) $input['quantity'] > $previousQuantity) {
                throw ApiException::validation("Yetersiz stok: {$source->name} deposunda {$previousQuantity} adet var, {$input['quantity']} adet transfer istendi.");
            }

            $newQuantity = $previousQuantity - (int) $input['quantity'];
            $sourceLevel->quantity = $newQuantity;
            $sourceLevel->save();

            $targetLevel = $this->lockLevel($input['productId'], $input['targetWarehouseId']);
            $targetLevel->quantity = (int) $targetLevel->quantity + (int) $input['quantity'];
            $targetLevel->save();

            // One row records the whole transfer (source in warehouse_id,
            // destination in target_warehouse_id) — matching the frontend.
            return $this->recordMovement([
                'type' => 'transfer',
                'product_id' => $input['productId'],
                'warehouse_id' => $input['sourceWarehouseId'],
                'target_warehouse_id' => $input['targetWarehouseId'],
                'quantity' => (int) $input['quantity'],
                'previous_quantity' => $previousQuantity,
                'new_quantity' => $newQuantity,
                'reason' => 'transfer',
                'supplier_id' => null,
                'purchase_order_id' => null,
                'user_id' => $input['userId'],
                'note' => $input['note'] ?? null,
            ]);
        }));
    }

    public function quantity(string $productId, string $warehouseId): int
    {
        return (int) (StockLevel::query()
            ->where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->value('quantity') ?? 0);
    }

    /**
     * Undoes the stock effect of a movement being soft-deleted ("cancelled"):
     * a giriş's quantity is removed, a çıkış's is put back, and a transfer's
     * is put back into the source warehouse and taken back out of the target.
     * Caller is expected to hold the movement row locked inside a transaction.
     */
    public function reverseMovement(StockMovement $movement): void
    {
        switch ($movement->type) {
            case 'giris':
                $level = $this->lockLevel($movement->product_id, $movement->warehouse_id);
                if ((int) $level->quantity < (int) $movement->quantity) {
                    throw ApiException::conflict('Bu stok girişi silinemez: depoda yeterli stok yok (stok başka işlemlerde kullanılmış olabilir).');
                }
                $level->quantity = (int) $level->quantity - (int) $movement->quantity;
                $level->save();
                break;

            case 'cikis':
                $level = $this->lockLevel($movement->product_id, $movement->warehouse_id);
                $level->quantity = (int) $level->quantity + (int) $movement->quantity;
                $level->save();
                break;

            case 'transfer':
                $sourceLevel = $this->lockLevel($movement->product_id, $movement->warehouse_id);
                $sourceLevel->quantity = (int) $sourceLevel->quantity + (int) $movement->quantity;
                $sourceLevel->save();

                $targetLevel = $this->lockLevel($movement->product_id, $movement->target_warehouse_id);
                if ((int) $targetLevel->quantity < (int) $movement->quantity) {
                    throw ApiException::conflict('Bu transfer silinemez: hedef depoda yeterli stok yok.');
                }
                $targetLevel->quantity = (int) $targetLevel->quantity - (int) $movement->quantity;
                $targetLevel->save();
                break;
        }
    }

    /** Re-applies a movement's original stock effect when it is restored from trash. */
    public function reapplyMovement(StockMovement $movement): void
    {
        switch ($movement->type) {
            case 'giris':
                $level = $this->lockLevel($movement->product_id, $movement->warehouse_id);
                $level->quantity = (int) $level->quantity + (int) $movement->quantity;
                $level->save();
                break;

            case 'cikis':
                $level = $this->lockLevel($movement->product_id, $movement->warehouse_id);
                if ((int) $level->quantity < (int) $movement->quantity) {
                    throw ApiException::conflict('Bu hareket geri yüklenemez: depoda yeterli stok yok.');
                }
                $level->quantity = (int) $level->quantity - (int) $movement->quantity;
                $level->save();
                break;

            case 'transfer':
                $sourceLevel = $this->lockLevel($movement->product_id, $movement->warehouse_id);
                if ((int) $sourceLevel->quantity < (int) $movement->quantity) {
                    throw ApiException::conflict('Bu transfer geri yüklenemez: kaynak depoda yeterli stok yok.');
                }
                $sourceLevel->quantity = (int) $sourceLevel->quantity - (int) $movement->quantity;
                $sourceLevel->save();

                $targetLevel = $this->lockLevel($movement->product_id, $movement->target_warehouse_id);
                $targetLevel->quantity = (int) $targetLevel->quantity + (int) $movement->quantity;
                $targetLevel->save();
                break;
        }
    }
}
