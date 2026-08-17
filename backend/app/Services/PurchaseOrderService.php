<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Support\JsonStore;
use Illuminate\Support\Carbon;

/** Direct PHP port of frontend/lib/api/purchase-orders.ts's mutation functions. */
class PurchaseOrderService
{
    public function __construct(private JsonStore $store, private StockService $stock)
    {
    }

    public static function total(array $po): int
    {
        return array_sum(array_map(fn ($i) => $i['quantity'] * $i['unitPrice'], $po['items']));
    }

    public static function isOverdue(array $po, string $nowIso): bool
    {
        return $po['status'] !== 'received' && $po['status'] !== 'cancelled' && $po['expectedAt'] < $nowIso;
    }

    public function toRow(array $po, array $suppliersById, array $warehousesById): array
    {
        return $po + [
            'supplierName' => $suppliersById[$po['supplierId']]['name'] ?? '-',
            'warehouseName' => $warehousesById[$po['warehouseId']]['name'] ?? '-',
            'total' => self::total($po),
            'itemCount' => count($po['items']),
            'receivedTotal' => array_sum(array_map(fn ($i) => $i['receivedQuantity'], $po['items'])),
            'orderedTotal' => array_sum(array_map(fn ($i) => $i['quantity'], $po['items'])),
        ];
    }

    private function validateItems(array $items, array $products): void
    {
        if (count($items) === 0) {
            throw ApiException::validation('En az bir kalem eklemelisiniz.');
        }
        $productIds = array_column($products, 'id');
        $seen = [];
        foreach ($items as $item) {
            if (! in_array($item['productId'], $productIds, true)) {
                throw ApiException::validation('Seçilen ürünlerden biri bulunamadı.');
            }
            if ($item['quantity'] <= 0) {
                throw ApiException::validation('Kalem miktarı sıfırdan büyük olmalı.');
            }
            if ($item['unitPrice'] < 0) {
                throw ApiException::validation('Birim fiyat negatif olamaz.');
            }
            if (isset($seen[$item['productId']])) {
                throw ApiException::validation('Aynı ürün birden fazla kez eklenemez.');
            }
            $seen[$item['productId']] = true;
        }
    }

    public function create(array $input): array
    {
        $suppliers = $this->store->read('suppliers');
        $warehouses = $this->store->read('warehouses');
        $products = $this->store->read('products');

        if (! collect($suppliers)->contains(fn ($s) => $s['id'] === $input['supplierId'])) {
            throw ApiException::validation('Tedarikçi bulunamadı.');
        }
        if (! collect($warehouses)->contains(fn ($w) => $w['id'] === $input['warehouseId'])) {
            throw ApiException::validation('Depo bulunamadı.');
        }
        if (empty($input['expectedAt'])) {
            throw ApiException::validation('Beklenen teslim tarihi gereklidir.');
        }
        $this->validateItems($input['items'], $products);

        return $this->store->transaction(function () use ($input) {
            $orders = $this->store->read('purchase_orders');
            $n = count($orders) + 1;

            $po = [
                'id' => $this->store->nextId($orders, 'po'),
                'code' => 'NET-PO-'.date('Y').sprintf('%04d', $n),
                'supplierId' => $input['supplierId'],
                'warehouseId' => $input['warehouseId'],
                'status' => 'draft',
                'items' => array_map(fn ($i) => $i + ['receivedQuantity' => 0], $input['items']),
                'createdAt' => Carbon::now()->toIso8601String(),
                'expectedAt' => $input['expectedAt'],
                'receivedAt' => null,
                'currency' => 'TRY',
                'notes' => $input['notes'] ?? null,
            ];
            array_unshift($orders, $po);
            $this->store->write('purchase_orders', $orders);

            return $po;
        });
    }

    public function update(string $id, array $input): array
    {
        return $this->store->transaction(function () use ($id, $input) {
            $orders = $this->store->read('purchase_orders');
            $index = collect($orders)->search(fn ($p) => $p['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Satın alma siparişi bulunamadı.');
            }
            $po = $orders[$index];

            if ($po['status'] !== 'draft' && $po['status'] !== 'ordered') {
                throw ApiException::conflict('Yalnızca taslak veya sipariş edilmiş siparişler düzenlenebilir.');
            }
            if (collect($po['items'])->contains(fn ($i) => $i['receivedQuantity'] > 0)) {
                throw ApiException::conflict('Kısmen de olsa teslim alınmış bir sipariş düzenlenemez.');
            }

            if (array_key_exists('supplierId', $input)) {
                if (! collect($this->store->read('suppliers'))->contains(fn ($s) => $s['id'] === $input['supplierId'])) {
                    throw ApiException::validation('Tedarikçi bulunamadı.');
                }
                $po['supplierId'] = $input['supplierId'];
            }
            if (array_key_exists('warehouseId', $input)) {
                if (! collect($this->store->read('warehouses'))->contains(fn ($w) => $w['id'] === $input['warehouseId'])) {
                    throw ApiException::validation('Depo bulunamadı.');
                }
                $po['warehouseId'] = $input['warehouseId'];
            }
            if (array_key_exists('expectedAt', $input)) {
                $po['expectedAt'] = $input['expectedAt'];
            }
            if (array_key_exists('notes', $input)) {
                $po['notes'] = $input['notes'];
            }
            if (array_key_exists('items', $input)) {
                $this->validateItems($input['items'], $this->store->read('products'));
                $po['items'] = array_map(fn ($i) => $i + ['receivedQuantity' => 0], $input['items']);
            }

            $orders[$index] = $po;
            $this->store->write('purchase_orders', $orders);

            return $po;
        });
    }

    public function delete(string $id): void
    {
        $this->store->transaction(function () use ($id) {
            $orders = $this->store->read('purchase_orders');
            $index = collect($orders)->search(fn ($p) => $p['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Satın alma siparişi bulunamadı.');
            }
            if ($orders[$index]['status'] !== 'draft') {
                throw ApiException::conflict('Yalnızca taslak siparişler silinebilir; gönderilmiş siparişleri iptal edin.');
            }
            unset($orders[$index]);
            $this->store->write('purchase_orders', array_values($orders));
        });
    }

    public function markOrdered(string $id): array
    {
        return $this->store->transaction(function () use ($id) {
            $orders = $this->store->read('purchase_orders');
            $index = collect($orders)->search(fn ($p) => $p['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Satın alma siparişi bulunamadı.');
            }
            if ($orders[$index]['status'] !== 'draft') {
                throw ApiException::conflict('Yalnızca taslak siparişler gönderilebilir.');
            }
            $orders[$index]['status'] = 'ordered';
            $this->store->write('purchase_orders', $orders);

            return $orders[$index];
        });
    }

    public function cancel(string $id): array
    {
        return $this->store->transaction(function () use ($id) {
            $orders = $this->store->read('purchase_orders');
            $index = collect($orders)->search(fn ($p) => $p['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Satın alma siparişi bulunamadı.');
            }
            if ($orders[$index]['status'] === 'received') {
                throw ApiException::conflict('Teslim alınmış sipariş iptal edilemez.');
            }
            $orders[$index]['status'] = 'cancelled';
            $this->store->write('purchase_orders', $orders);

            return $orders[$index];
        });
    }

    /** @param array<string,int> $receivedQuantities productId => qty being received now */
    public function receive(string $id, array $receivedQuantities, string $userId, ?string $idempotencyKey): array
    {
        return $this->store->transaction(function () use ($id, $receivedQuantities, $userId, $idempotencyKey) {
            $orders = $this->store->read('purchase_orders');
            $index = collect($orders)->search(fn ($p) => $p['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Satın alma siparişi bulunamadı.');
            }
            $po = $orders[$index];
            if ($po['status'] === 'cancelled') {
                throw ApiException::conflict('İptal edilmiş sipariş teslim alınamaz.');
            }
            if ($po['status'] === 'received') {
                throw ApiException::conflict('Sipariş zaten tamamen teslim alınmış.');
            }

            // Stock effects happen first so a failed movement leaves the order untouched.
            foreach ($po['items'] as &$item) {
                $add = $receivedQuantities[$item['productId']] ?? 0;
                if ($add <= 0) {
                    continue;
                }
                $capped = min($add, $item['quantity'] - $item['receivedQuantity']);
                if ($capped <= 0) {
                    continue;
                }

                $this->stock->stockIn([
                    'productId' => $item['productId'],
                    'warehouseId' => $po['warehouseId'],
                    'quantity' => $capped,
                    'supplierId' => $po['supplierId'],
                    'purchaseOrderId' => $po['id'],
                    'note' => "{$po['code']} teslim alındı",
                    'userId' => $userId,
                    'idempotencyKey' => $idempotencyKey ? "{$idempotencyKey}-{$item['productId']}" : null,
                ]);
                $item['receivedQuantity'] += $capped;
            }
            unset($item);

            $allReceived = collect($po['items'])->every(fn ($i) => $i['receivedQuantity'] >= $i['quantity']);
            $anyReceived = collect($po['items'])->contains(fn ($i) => $i['receivedQuantity'] > 0);
            $po['status'] = $allReceived ? 'received' : ($anyReceived ? 'partially_received' : $po['status']);
            if ($allReceived) {
                $po['receivedAt'] = Carbon::now()->toIso8601String();
            }

            $orders = $this->store->read('purchase_orders');
            $orders[collect($orders)->search(fn ($p) => $p['id'] === $id)] = $po;
            $this->store->write('purchase_orders', $orders);

            return $po;
        });
    }

    /** @return array{successCount:int, failed: array<int, array{id:string, reason:string}>} */
    public function bulkMarkOrdered(array $ids): array
    {
        return $this->store->transaction(function () use ($ids) {
            $orders = $this->store->read('purchase_orders');
            $failed = [];
            $successCount = 0;

            foreach ($ids as $id) {
                $index = collect($orders)->search(fn ($p) => $p['id'] === $id);
                if ($index === false) {
                    $failed[] = ['id' => $id, 'reason' => 'Sipariş bulunamadı.'];
                } elseif ($orders[$index]['status'] !== 'draft') {
                    $failed[] = ['id' => $id, 'reason' => 'Yalnızca taslak siparişler gönderilebilir.'];
                } else {
                    $orders[$index]['status'] = 'ordered';
                    $successCount++;
                }
            }
            $this->store->write('purchase_orders', $orders);

            return ['successCount' => $successCount, 'failed' => $failed];
        });
    }

    public function bulkCancel(array $ids): array
    {
        return $this->store->transaction(function () use ($ids) {
            $orders = $this->store->read('purchase_orders');
            $failed = [];
            $successCount = 0;

            foreach ($ids as $id) {
                $index = collect($orders)->search(fn ($p) => $p['id'] === $id);
                if ($index === false) {
                    $failed[] = ['id' => $id, 'reason' => 'Sipariş bulunamadı.'];
                } elseif ($orders[$index]['status'] === 'received') {
                    $failed[] = ['id' => $id, 'reason' => 'Teslim alınmış sipariş iptal edilemez.'];
                } elseif ($orders[$index]['status'] === 'cancelled') {
                    $failed[] = ['id' => $id, 'reason' => 'Sipariş zaten iptal edilmiş.'];
                } else {
                    $orders[$index]['status'] = 'cancelled';
                    $successCount++;
                }
            }
            $this->store->write('purchase_orders', $orders);

            return ['successCount' => $successCount, 'failed' => $failed];
        });
    }

    public function bulkDelete(array $ids): array
    {
        return $this->store->transaction(function () use ($ids) {
            $orders = $this->store->read('purchase_orders');
            $failed = [];
            $successCount = 0;

            foreach ($ids as $id) {
                $index = collect($orders)->search(fn ($p) => $p['id'] === $id);
                if ($index === false) {
                    $failed[] = ['id' => $id, 'reason' => 'Sipariş bulunamadı.'];
                } elseif ($orders[$index]['status'] !== 'draft') {
                    $failed[] = ['id' => $id, 'reason' => 'Yalnızca taslak siparişler silinebilir.'];
                } else {
                    unset($orders[$index]);
                    $successCount++;
                }
            }
            $this->store->write('purchase_orders', array_values($orders));

            return ['successCount' => $successCount, 'failed' => $failed];
        });
    }
}
