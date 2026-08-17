<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Support\JsonStore;
use Illuminate\Support\Carbon;

/**
 * Direct PHP port of frontend/lib/api/movements.ts's mutation functions.
 * Every write happens inside JsonStore::transaction so stock_levels and
 * stock_movements move together; idempotency keys are persisted (not an
 * in-memory Map like the frontend mock) so a retried request after a crash
 * still short-circuits to the original movement.
 */
class StockService
{
    public function __construct(private JsonStore $store)
    {
    }

    private function findLevelIndex(array $levels, string $productId, string $warehouseId): int|false
    {
        return collect($levels)->search(fn ($s) => $s['productId'] === $productId && $s['warehouseId'] === $warehouseId);
    }

    private function withIdempotency(?string $key, callable $create): array
    {
        if ($key) {
            $keys = $this->store->read('idempotency_keys');
            $existing = collect($keys)->firstWhere('key', $key);
            if ($existing) {
                $movement = collect($this->store->read('stock_movements'))->firstWhere('id', $existing['movementId']);
                if ($movement) {
                    return $movement;
                }
            }
        }

        $movement = $create();

        if ($key) {
            $keys = $this->store->read('idempotency_keys');
            $keys[] = ['key' => $key, 'movementId' => $movement['id']];
            $this->store->write('idempotency_keys', $keys);
        }

        return $movement;
    }

    public function stockIn(array $input): array
    {
        if ($input['quantity'] <= 0) {
            throw ApiException::validation('Miktar sıfırdan büyük olmalı.');
        }
        $product = collect($this->store->read('products'))->firstWhere('id', $input['productId']);
        if (! $product) {
            throw ApiException::notFound('Ürün bulunamadı.');
        }

        return $this->store->transaction(function () use ($input) {
            return $this->withIdempotency($input['idempotencyKey'] ?? null, function () use ($input) {
                $levels = $this->store->read('stock_levels');
                $index = $this->findLevelIndex($levels, $input['productId'], $input['warehouseId']);
                $previousQuantity = $index !== false ? $levels[$index]['quantity'] : 0;
                $newQuantity = $previousQuantity + $input['quantity'];

                if ($index !== false) {
                    $levels[$index]['quantity'] = $newQuantity;
                } else {
                    $levels[] = ['productId' => $input['productId'], 'warehouseId' => $input['warehouseId'], 'quantity' => $newQuantity];
                }
                $this->store->write('stock_levels', $levels);

                $movements = $this->store->read('stock_movements');
                $movement = [
                    'id' => $this->store->nextId($movements, 'mv'),
                    'type' => 'giris',
                    'productId' => $input['productId'],
                    'warehouseId' => $input['warehouseId'],
                    'targetWarehouseId' => null,
                    'quantity' => $input['quantity'],
                    'previousQuantity' => $previousQuantity,
                    'newQuantity' => $newQuantity,
                    'reason' => 'satin_alma',
                    'supplierId' => $input['supplierId'] ?? null,
                    'purchaseOrderId' => $input['purchaseOrderId'] ?? null,
                    'userId' => $input['userId'],
                    'note' => $input['note'] ?? null,
                    'createdAt' => Carbon::now()->toIso8601String(),
                ];
                array_unshift($movements, $movement);
                $this->store->write('stock_movements', $movements);

                return $movement;
            });
        });
    }

    public function stockOut(array $input): array
    {
        if ($input['quantity'] <= 0) {
            throw ApiException::validation('Miktar sıfırdan büyük olmalı.');
        }
        $product = collect($this->store->read('products'))->firstWhere('id', $input['productId']);
        if (! $product) {
            throw ApiException::notFound('Ürün bulunamadı.');
        }

        $levels = $this->store->read('stock_levels');
        $index = $this->findLevelIndex($levels, $input['productId'], $input['warehouseId']);
        $currentQuantity = $index !== false ? $levels[$index]['quantity'] : 0;
        if ($input['quantity'] > $currentQuantity) {
            throw ApiException::validation("Yetersiz stok: bu depoda {$currentQuantity} adet var, {$input['quantity']} adet çıkış istendi.");
        }

        return $this->store->transaction(function () use ($input) {
            return $this->withIdempotency($input['idempotencyKey'] ?? null, function () use ($input) {
                $levels = $this->store->read('stock_levels');
                $index = $this->findLevelIndex($levels, $input['productId'], $input['warehouseId']);
                $previousQuantity = $levels[$index]['quantity'];
                $newQuantity = $previousQuantity - $input['quantity'];
                $levels[$index]['quantity'] = $newQuantity;
                $this->store->write('stock_levels', $levels);

                $movements = $this->store->read('stock_movements');
                $movement = [
                    'id' => $this->store->nextId($movements, 'mv'),
                    'type' => 'cikis',
                    'productId' => $input['productId'],
                    'warehouseId' => $input['warehouseId'],
                    'targetWarehouseId' => null,
                    'quantity' => $input['quantity'],
                    'previousQuantity' => $previousQuantity,
                    'newQuantity' => $newQuantity,
                    'reason' => $input['reason'],
                    'supplierId' => null,
                    'purchaseOrderId' => null,
                    'userId' => $input['userId'],
                    'note' => $input['note'] ?? null,
                    'createdAt' => Carbon::now()->toIso8601String(),
                ];
                array_unshift($movements, $movement);
                $this->store->write('stock_movements', $movements);

                return $movement;
            });
        });
    }

    public function transfer(array $input): array
    {
        if ($input['sourceWarehouseId'] === $input['targetWarehouseId']) {
            throw ApiException::validation('Kaynak ve hedef depo aynı olamaz.');
        }
        if ($input['quantity'] <= 0) {
            throw ApiException::validation('Miktar sıfırdan büyük olmalı.');
        }

        $product = collect($this->store->read('products'))->firstWhere('id', $input['productId']);
        if ($product && $product['status'] === 'pasif') {
            throw ApiException::validation("\"{$product['name']}\" pasif durumda olduğu için stok transferi yapılamaz.");
        }

        $levels = $this->store->read('stock_levels');
        $sourceIndex = $this->findLevelIndex($levels, $input['productId'], $input['sourceWarehouseId']);
        $currentQuantity = $sourceIndex !== false ? $levels[$sourceIndex]['quantity'] : 0;
        if ($input['quantity'] > $currentQuantity) {
            $sourceName = collect($this->store->read('warehouses'))->firstWhere('id', $input['sourceWarehouseId'])['name'] ?? '-';
            throw ApiException::validation("Yetersiz stok: {$sourceName} deposunda {$currentQuantity} adet var, {$input['quantity']} adet transfer istendi.");
        }

        return $this->store->transaction(function () use ($input) {
            return $this->withIdempotency($input['idempotencyKey'] ?? null, function () use ($input) {
                $levels = $this->store->read('stock_levels');
                $sourceIndex = $this->findLevelIndex($levels, $input['productId'], $input['sourceWarehouseId']);
                $previousQuantity = $levels[$sourceIndex]['quantity'];
                $newQuantity = $previousQuantity - $input['quantity'];
                $levels[$sourceIndex]['quantity'] = $newQuantity;

                $targetIndex = $this->findLevelIndex($levels, $input['productId'], $input['targetWarehouseId']);
                if ($targetIndex !== false) {
                    $levels[$targetIndex]['quantity'] += $input['quantity'];
                } else {
                    $levels[] = ['productId' => $input['productId'], 'warehouseId' => $input['targetWarehouseId'], 'quantity' => $input['quantity']];
                }
                $this->store->write('stock_levels', $levels);

                $movements = $this->store->read('stock_movements');
                $movement = [
                    'id' => $this->store->nextId($movements, 'mv'),
                    'type' => 'transfer',
                    'productId' => $input['productId'],
                    'warehouseId' => $input['sourceWarehouseId'],
                    'targetWarehouseId' => $input['targetWarehouseId'],
                    'quantity' => $input['quantity'],
                    'previousQuantity' => $previousQuantity,
                    'newQuantity' => $newQuantity,
                    'reason' => 'transfer',
                    'supplierId' => null,
                    'purchaseOrderId' => null,
                    'userId' => $input['userId'],
                    'note' => $input['note'] ?? null,
                    'createdAt' => Carbon::now()->toIso8601String(),
                ];
                array_unshift($movements, $movement);
                $this->store->write('stock_movements', $movements);

                return $movement;
            });
        });
    }

    public function quantity(string $productId, string $warehouseId): int
    {
        $levels = $this->store->read('stock_levels');
        $index = $this->findLevelIndex($levels, $productId, $warehouseId);

        return $index !== false ? $levels[$index]['quantity'] : 0;
    }
}
