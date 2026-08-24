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

    private function validateItems(array $items, bool $isDraft = false): void
    {
        if (count($items) === 0 && !$isDraft) {
            throw ApiException::validation('En az bir kalem eklemelisiniz.');
        }
        $productIds = Product::query()->pluck('id')->flip();
        $seen = [];
        foreach ($items as $item) {
            $hasProduct = ! empty($item['productId']);
            $hasAdhoc = ! empty($item['productName']) && ! empty($item['unit']);
            if (! $hasProduct && ! $hasAdhoc) {
                throw ApiException::validation('Her kalem için bir ürün seçin veya ürün adı ve birim girin.');
            }
            if ($hasProduct && ! $productIds->has($item['productId'])) {
                throw ApiException::validation('Seçilen ürünlerden biri bulunamadı.');
            }
            if ($item['quantity'] <= 0) {
                throw ApiException::validation('Kalem miktarı sıfırdan büyük olmalı.');
            }
            if ($item['unitPrice'] < 0) {
                throw ApiException::validation('Birim fiyat negatif olamaz.');
            }
            if ($hasProduct) {
                if (isset($seen[$item['productId']])) {
                    throw ApiException::validation('Aynı ürün birden fazla kez eklenemez.');
                }
                $seen[$item['productId']] = true;
            }
        }
    }

    /**
     * A supplier typed as free text on a purchase order becomes a real,
     * minimal Supplier record — reused by name if one already exists —
     * so it shows up in Tedarikçiler and can be filled in (contact,
     * phone, city) later instead of staying a dead-end string on the PO.
     */
    private function findOrCreateSupplierId(string $name, ?string $email): string
    {
        $name = trim($name);
        $existing = Supplier::query()->whereRaw('lower(name) = ?', [mb_strtolower($name)])->first();
        if ($existing) {
            return $existing->id;
        }

        $supplier = Supplier::query()->create([
            'id' => IdGenerator::nextId('suppliers', 'id', 'sup'),
            'name' => $name,
            'contact_name' => '',
            'emails' => $email ? [$email] : [],
            'phone' => '',
            'city' => '',
        ]);

        return $supplier->id;
    }

    /**
     * Same idea for an order line typed as free text (no catalog product
     * picked): create a minimal Product — reused by name if one already
     * exists — under the resolved supplier, so it lands in Ürün Yönetimi
     * with just name/unit/price and the rest (SKU, kategori, marka, min/max
     * stok) can be completed there later.
     */
    private function findOrCreateProductId(string $name, string $unit, float $unitPrice, string $supplierId): string
    {
        $name = trim($name);
        $existing = Product::query()->whereRaw('lower(name) = ?', [mb_strtolower($name)])->first();
        if ($existing) {
            return $existing->id;
        }

        $id = IdGenerator::nextId('products', 'id', 'prd', 4);
        $product = Product::query()->create([
            'id' => $id,
            'name' => $name,
            'sku' => strtoupper($id),
            'barcode' => '',
            'category_id' => null,
            'brand' => '',
            'unit' => trim($unit),
            'purchase_price' => $unitPrice,
            'sale_price' => null,
            'min_stock' => 0,
            'max_stock' => 0,
            'status' => 'aktif',
            'supplier_id' => $supplierId,
        ]);

        return $product->id;
    }

    /**
     * Items without any resolvable supplier fall back to the old
     * denormalized-text-only behavior (no catalog product to attach to).
     */
    private function resolveAdhocItems(array $items, ?string $supplierId): array
    {
        if (! $supplierId) {
            return $items;
        }

        foreach ($items as &$item) {
            if (empty($item['productId']) && ! empty($item['productName'])) {
                $item['productId'] = $this->findOrCreateProductId(
                    $item['productName'],
                    $item['unit'] ?? '',
                    (float) ($item['unitPrice'] ?? 0),
                    $supplierId,
                );
            }
        }
        unset($item);

        return $items;
    }

    /**
     * Resolves a request's supplier + item inputs to real IDs, creating
     * placeholder Supplier/Product rows for anything typed as free text.
     *
     * @return array{0: ?string, 1: array} [$supplierId, $items]
     */
    private function resolveAdhocEntities(array $input): array
    {
        $supplierId = $input['supplierId'] ?? null;
        if (empty($supplierId) && ! empty($input['adhocSupplierName'])) {
            $supplierId = $this->findOrCreateSupplierId($input['adhocSupplierName'], $input['adhocSupplierEmail'] ?? null);
        }

        return [$supplierId, $this->resolveAdhocItems($input['items'] ?? [], $supplierId)];
    }

    private function syncItems(PurchaseOrder $po, array $items): void
    {
        $po->items()->delete();
        $productIds = collect($items)->pluck('productId')->filter()->unique()->values();
        $productsById = Product::query()->whereIn('id', $productIds)->get()->keyBy('id');

        foreach ($items as $item) {
            $product = ! empty($item['productId']) ? $productsById->get($item['productId']) : null;
            $po->items()->create([
                'product_id' => $product?->id,
                'product_name' => $product?->name ?? trim($item['productName'] ?? ''),
                'unit' => $product?->unit ?? trim($item['unit'] ?? ''),
                'quantity' => (int) $item['quantity'],
                'unit_price' => $item['unitPrice'],
                'received_quantity' => 0,
            ]);
        }
    }

    public function create(array $input, User $user): array
    {
        if (! empty($input['supplierId']) && ! Supplier::query()->whereKey($input['supplierId'])->exists()) {
            throw ApiException::validation('Tedarikçi bulunamadı.');
        }
        if (empty($input['supplierId']) && empty($input['adhocSupplierName']) && empty($input['isDraft'])) {
            throw ApiException::validation('Bir tedarikçi seçin veya adını girin.');
        }
        if (! empty($input['warehouseId']) && ! Warehouse::query()->whereKey($input['warehouseId'])->exists()) {
            throw ApiException::validation('Depo bulunamadı.');
        }
        if (empty($input['expectedAt'])) {
            throw ApiException::validation('Beklenen teslim tarihi gereklidir.');
        }
        $isDraft = !empty($input['isDraft']);
        $this->validateItems($input['items'], $isDraft);

        // If specifically requested as a draft, save it as a draft. Otherwise, an
        // approver's finished order is auto-approved (goes straight to `ordered`,
        // same as if they'd approved their own submission); everyone else's order
        // lands in the approval queue instead.
        $isApprover = $user->can('purchase.approve');
        $initialStatus = $isDraft ? 'draft' : ($isApprover ? 'ordered' : 'pending_approval');

        $po = DB::transaction(function () use ($input, $initialStatus, $user) {
            [$supplierId, $items] = $this->resolveAdhocEntities($input);

            $po = PurchaseOrder::query()->create([
                'id' => IdGenerator::nextId('purchase_orders', 'id', 'po', 4),
                'code' => IdGenerator::nextCode('purchase_orders', 'code', 'NET-PO-'),
                'supplier_id' => $supplierId,
                'adhoc_supplier_name' => null,
                'adhoc_supplier_email' => null,
                'warehouse_id' => $input['warehouseId'] ?? null,
                'status' => $initialStatus,
                'priority' => $input['priority'] ?? 'medium',
                'created_at' => Carbon::now(),
                'created_by' => $user->getKey(),
                'approved_by' => $initialStatus === 'ordered' ? $user->getKey() : null,
                'expected_at' => $input['expectedAt'],
                'received_at' => null,
                'currency' => 'TRY',
                'notes' => $input['notes'] ?? null,
            ]);
            $this->syncItems($po, $items);

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

            if (array_key_exists('supplierId', $input) || array_key_exists('adhocSupplierName', $input)) {
                if (! empty($input['supplierId'])) {
                    if (! Supplier::query()->whereKey($input['supplierId'])->exists()) {
                        throw ApiException::validation('Tedarikçi bulunamadı.');
                    }
                    $po->supplier_id = $input['supplierId'];
                } elseif (! empty($input['adhocSupplierName'])) {
                    $po->supplier_id = $this->findOrCreateSupplierId($input['adhocSupplierName'], $input['adhocSupplierEmail'] ?? null);
                } else {
                    $po->supplier_id = null;
                }
                $po->adhoc_supplier_name = null;
                $po->adhoc_supplier_email = null;
            }
            if (array_key_exists('warehouseId', $input)) {
                if (! empty($input['warehouseId']) && ! Warehouse::query()->whereKey($input['warehouseId'])->exists()) {
                    throw ApiException::validation('Depo bulunamadı.');
                }
                $po->warehouse_id = $input['warehouseId'] ?? null;
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
                $this->syncItems($po, $this->resolveAdhocItems($input['items'], $po->supplier_id));
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
     * @param  array<string,int>  $receivedQuantities  itemId => qty being received now
     */
    public function receive(string $id, array $receivedQuantities, ?string $warehouseId, string $userId, ?string $idempotencyKey): array
    {
        $po = DB::transaction(function () use ($id, $receivedQuantities, $warehouseId, $userId, $idempotencyKey) {
            $po = $this->findOrFail($id, lock: true);
            if ($po->status === 'cancelled') {
                throw ApiException::conflict('İptal edilmiş sipariş teslim alınamaz.');
            }
            if ($po->status === 'received') {
                throw ApiException::conflict('Sipariş zaten tamamen teslim alınmış.');
            }

            $effectiveWarehouseId = $warehouseId ?? $po->warehouse_id;

            foreach ($po->items as $item) {
                // Front-end now sends received quantities keyed by $item->id.
                // We fallback to product_id for compatibility if needed.
                $add = $receivedQuantities[$item->id] ?? ($receivedQuantities[$item->product_id] ?? 0);
                if ($add <= 0) {
                    continue;
                }
                // Over-receipt is clipped to what's still outstanding.
                $capped = min($add, (int) $item->quantity - (int) $item->received_quantity);
                if ($capped <= 0) {
                    continue;
                }

                if ($item->product_id) {
                    if (!$effectiveWarehouseId) {
                        throw ApiException::validation("Stoklara eklenecek ürünler için bir depo seçilmelidir.");
                    }
                    $this->stock->stockIn([
                        'productId' => $item->product_id,
                        'warehouseId' => $effectiveWarehouseId,
                        'quantity' => $capped,
                        'supplierId' => $po->supplier_id,
                        'purchaseOrderId' => $po->id,
                        'note' => "{$po->code} teslim alındı",
                        'userId' => $userId,
                        // Per-line key so a replayed receive is idempotent line by line.
                        'idempotencyKey' => $idempotencyKey ? "{$idempotencyKey}-{$item->id}" : null,
                    ]);
                }

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
