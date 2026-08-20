<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\IdGenerator;
use App\Support\Present;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Port of frontend/lib/api/purchase-orders.ts's mutation functions.
 *
 * The status transitions here are the authority; frontend/lib/purchase-order-actions.ts
 * mirrors them only to decide which buttons to show, and a request that
 * disagrees gets a CONFLICT.
 */
class PurchaseOrderService
{
    public function __construct(private StockService $stock)
    {
    }

    public static function total(PurchaseOrder $po): float
    {
        return (float) $po->items->sum(fn ($i) => (int) $i->quantity * (float) $i->unit_price);
    }

    public static function isOverdue(PurchaseOrder $po, ?Carbon $now = null): bool
    {
        $now ??= Carbon::now();

        return ! in_array($po->status, ['received', 'cancelled'], true)
            && $po->expected_at !== null
            && $po->expected_at->lt($now);
    }

    public function toRow(PurchaseOrder $po): array
    {
        return Present::purchaseOrder($po) + [
            'supplierName' => $po->supplier->name ?? '-',
            'warehouseName' => $po->warehouse->name ?? '-',
            'total' => self::total($po),
            'itemCount' => $po->items->count(),
            'receivedTotal' => (int) $po->items->sum('received_quantity'),
            'orderedTotal' => (int) $po->items->sum('quantity'),
            'invoiceFilePath' => $po->invoice_file_path,
        ];
    }

    private function findOrFail(string $id, bool $lock = false): PurchaseOrder
    {
        $query = PurchaseOrder::query()->with(['items', 'supplier', 'warehouse']);
        if ($lock) {
            $query->lockForUpdate();
        }
        $po = $query->find($id);
        if (! $po) {
            throw ApiException::notFound('Satın alma siparişi bulunamadı.');
        }

        return $po;
    }

    private function validateItems(array $items): void
    {
        if (count($items) === 0) {
            throw ApiException::validation('En az bir kalem eklemelisiniz.');
        }
        $productIds = Product::query()->pluck('id')->flip();
        $seen = [];
        foreach ($items as $item) {
            if (! $productIds->has($item['productId'])) {
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

    private function syncItems(PurchaseOrder $po, array $items): void
    {
        $po->items()->delete();
        foreach ($items as $item) {
            $po->items()->create([
                'product_id' => $item['productId'],
                'quantity' => (int) $item['quantity'],
                'unit_price' => $item['unitPrice'],
                'received_quantity' => 0,
            ]);
        }
    }

    public function create(array $input, User $user): array
    {
        if (! Supplier::query()->whereKey($input['supplierId'])->exists()) {
            throw ApiException::validation('Tedarikçi bulunamadı.');
        }
        if (! Warehouse::query()->whereKey($input['warehouseId'])->exists()) {
            throw ApiException::validation('Depo bulunamadı.');
        }
        if (empty($input['expectedAt'])) {
            throw ApiException::validation('Beklenen teslim tarihi gereklidir.');
        }
        $this->validateItems($input['items']);

        // If specifically requested as a draft, save it as a draft. Otherwise, 
        // approvers open orders as drafts they can send straight through; everyone
        // else's order lands in the approval queue immediately.
        $initialStatus = !empty($input['isDraft']) ? 'draft' : ($user->can('purchase.approve') ? 'draft' : 'pending_approval');

        $po = DB::transaction(function () use ($input, $initialStatus, $user) {
            $po = PurchaseOrder::query()->create([
                'id' => IdGenerator::nextId('purchase_orders', 'id', 'po', 4),
                'code' => IdGenerator::nextCode('purchase_orders', 'code', 'NET-PO-'),
                'supplier_id' => $input['supplierId'],
                'warehouse_id' => $input['warehouseId'],
                'status' => $initialStatus,
                'priority' => $input['priority'] ?? 'medium',
                'created_at' => Carbon::now(),
                'created_by' => $user->getKey(),
                'expected_at' => $input['expectedAt'],
                'received_at' => null,
                'currency' => 'TRY',
                'notes' => $input['notes'] ?? null,
            ]);
            $this->syncItems($po, $input['items']);

            return $po;
        });

        return Present::purchaseOrder($po->fresh(['items']));
    }

    public function update(string $id, array $input, User $user): array
    {
        $po = DB::transaction(function () use ($id, $input, $user) {
            $po = $this->findOrFail($id, lock: true);

            // Editing stays open while an order is still being negotiated:
            // draft, awaiting approval, or sent but with nothing received yet.
            if (! in_array($po->status, ['draft', 'pending_approval', 'ordered'], true)) {
                throw ApiException::conflict('Yalnızca taslak, onay bekleyen veya sipariş edilmiş siparişler düzenlenebilir.');
            }
            // Once an order has been approved and sent (`ordered`), only an approver
            // can still change it — staff would otherwise edit around the approval.
            if ($po->status === 'ordered' && ! $user->can('purchase.approve')) {
                throw ApiException::forbidden('Sipariş edilmiş bir siparişi yalnızca onay yetkisi olanlar düzenleyebilir.');
            }
            if ($po->items->contains(fn ($i) => (int) $i->received_quantity > 0)) {
                throw ApiException::conflict('Kısmen de olsa teslim alınmış bir sipariş düzenlenemez.');
            }

            if (array_key_exists('supplierId', $input)) {
                if (! Supplier::query()->whereKey($input['supplierId'])->exists()) {
                    throw ApiException::validation('Tedarikçi bulunamadı.');
                }
                $po->supplier_id = $input['supplierId'];
            }
            if (array_key_exists('warehouseId', $input)) {
                if (! Warehouse::query()->whereKey($input['warehouseId'])->exists()) {
                    throw ApiException::validation('Depo bulunamadı.');
                }
                $po->warehouse_id = $input['warehouseId'];
            }
            if (array_key_exists('expectedAt', $input)) {
                $po->expected_at = $input['expectedAt'];
            }
            if (array_key_exists('priority', $input)) {
                $po->priority = $input['priority'];
            }
            if (array_key_exists('notes', $input)) {
                $po->notes = $input['notes'];
            }
            if (array_key_exists('items', $input)) {
                $this->validateItems($input['items']);
                $this->syncItems($po, $input['items']);
            }
            $po->save();

            return $po;
        });

        return Present::purchaseOrder($po->fresh(['items']));
    }

    public function delete(string $id, string $userId): void
    {
        DB::transaction(function () use ($id, $userId) {
            $po = $this->findOrFail($id, lock: true);
            if (! in_array($po->status, ['draft', 'cancelled'], true)) {
                throw ApiException::conflict('Yalnızca taslak ve iptal edilmiş siparişler silinebilir.');
            }
            $po->items()->delete();
            $po->deleteAs($userId);
        });
    }

    private function transition(string $id, array $allowedFrom, string $to, string $conflictMessage, ?callable $onTransition = null): array
    {
        $po = DB::transaction(function () use ($id, $allowedFrom, $to, $conflictMessage, $onTransition) {
            $po = $this->findOrFail($id, lock: true);
            if (! in_array($po->status, $allowedFrom, true)) {
                throw ApiException::conflict($conflictMessage);
            }
            $po->status = $to;
            if ($onTransition) {
                $onTransition($po);
            }
            $po->save();

            return $po;
        });

        return $this->toRow($po->fresh(['items', 'supplier', 'warehouse', 'createdByUser', 'approvedByUser']));
    }

    public function markOrdered(string $id): array
    {
        return $this->transition($id, ['draft'], 'ordered', 'Yalnızca taslak siparişler gönderilebilir.');
    }

    public function requestApproval(string $id): array
    {
        return $this->transition($id, ['draft'], 'pending_approval', 'Yalnızca taslak siparişler onaya gönderilebilir.');
    }

    public function approve(string $id, User $user): array
    {
        return $this->transition($id, ['pending_approval'], 'ordered', 'Yalnızca onay bekleyen siparişler onaylanabilir.', function ($po) use ($user) {
            $po->approved_by = $user->getKey();
        });
    }

    public function reject(string $id, string $reason): array
    {
        $po = DB::transaction(function () use ($id, $reason) {
            $po = $this->findOrFail($id, lock: true);
            if ($po->status !== 'pending_approval') {
                throw ApiException::conflict('Yalnızca onay bekleyen siparişler reddedilebilir.');
            }
            $po->status = 'cancelled';
            $po->rejection_reason = $reason;
            $po->save();
            return $po;
        });

        return $this->toRow($po->fresh(['items', 'supplier', 'warehouse']));
    }

    public function cancel(string $id, string $reason): array
    {
        $po = DB::transaction(function () use ($id, $reason) {
            $po = $this->findOrFail($id, lock: true);
            if ($po->status === 'received') {
                throw ApiException::conflict('Teslim alınmış sipariş iptal edilemez.');
            }
            $po->status = 'cancelled';
            $po->rejection_reason = $reason;
            $po->save();

            return $po;
        });

        return $this->toRow($po->fresh(['items', 'supplier', 'warehouse']));
    }

    /**
     * @param  array<string,int>  $receivedQuantities  productId => qty being received now
     */
    public function receive(string $id, array $receivedQuantities, string $userId, ?string $idempotencyKey): array
    {
        $po = DB::transaction(function () use ($id, $receivedQuantities, $userId, $idempotencyKey) {
            $po = $this->findOrFail($id, lock: true);
            if ($po->status === 'cancelled') {
                throw ApiException::conflict('İptal edilmiş sipariş teslim alınamaz.');
            }
            if ($po->status === 'received') {
                throw ApiException::conflict('Sipariş zaten tamamen teslim alınmış.');
            }
            if (empty($po->invoice_file_path)) {
                throw ApiException::validation('Teslim almak için fatura yüklenmesi zorunludur.');
            }

            foreach ($po->items as $item) {
                $add = $receivedQuantities[$item->product_id] ?? 0;
                if ($add <= 0) {
                    continue;
                }
                // Over-receipt is clipped to what's still outstanding.
                $capped = min($add, (int) $item->quantity - (int) $item->received_quantity);
                if ($capped <= 0) {
                    continue;
                }

                $this->stock->stockIn([
                    'productId' => $item->product_id,
                    'warehouseId' => $po->warehouse_id,
                    'quantity' => $capped,
                    'supplierId' => $po->supplier_id,
                    'purchaseOrderId' => $po->id,
                    'note' => "{$po->code} teslim alındı",
                    'userId' => $userId,
                    // Per-line key so a replayed receive is idempotent line by line.
                    'idempotencyKey' => $idempotencyKey ? "{$idempotencyKey}-{$item->product_id}" : null,
                ]);

                $item->received_quantity = (int) $item->received_quantity + $capped;
                $item->save();
            }

            $items = $po->items()->get();
            $allReceived = $items->every(fn ($i) => (int) $i->received_quantity >= (int) $i->quantity);
            $anyReceived = $items->contains(fn ($i) => (int) $i->received_quantity > 0);

            if ($allReceived) {
                $po->status = 'received';
                $po->received_at = Carbon::now();
            } elseif ($anyReceived) {
                $po->status = 'partially_received';
            }
            $po->save();

            return $po;
        });

        return $this->toRow($po->fresh(['items', 'supplier', 'warehouse']));
    }

    /**
     * Bulk helpers never abort on the first bad row — they report per-id
     * reasons so the UI can show "3 gönderildi, 2 başarısız".
     *
     * @return array{successCount:int, failed: array<int, array{id:string, reason:string}>}
     */
    private function bulk(array $ids, callable $apply): array
    {
        return DB::transaction(function () use ($ids, $apply) {
            $failed = [];
            $successCount = 0;

            foreach ($ids as $id) {
                $po = PurchaseOrder::query()->lockForUpdate()->find($id);
                if (! $po) {
                    $failed[] = ['id' => $id, 'reason' => 'Sipariş bulunamadı.'];

                    continue;
                }
                $reason = $apply($po);
                if ($reason !== null) {
                    $failed[] = ['id' => $id, 'reason' => $reason];
                } else {
                    $successCount++;
                }
            }

            return ['successCount' => $successCount, 'failed' => $failed];
        });
    }

    public function bulkMarkOrdered(array $ids): array
    {
        return $this->bulk($ids, function (PurchaseOrder $po) {
            if ($po->status !== 'draft') {
                return 'Yalnızca taslak siparişler gönderilebilir.';
            }
            $po->status = 'ordered';
            $po->save();

            return null;
        });
    }

    public function bulkCancel(array $ids): array
    {
        return $this->bulk($ids, function (PurchaseOrder $po) {
            if ($po->status === 'received') {
                return 'Teslim alınmış sipariş iptal edilemez.';
            }
            if ($po->status === 'cancelled') {
                return 'Sipariş zaten iptal edilmiş.';
            }
            $po->status = 'cancelled';
            $po->save();

            return null;
        });
    }

    public function bulkDelete(array $ids, string $userId): array
    {
        return $this->bulk($ids, function (PurchaseOrder $po) use ($userId) {
            if (! in_array($po->status, ['draft', 'cancelled'], true)) {
                return 'Yalnızca taslak ve iptal edilmiş siparişler silinebilir.';
            }
            $po->items()->delete();
            $po->deleteAs($userId);

            return null;
        });
    }
}
