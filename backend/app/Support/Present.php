<?php

namespace App\Support;

use App\Models\Category;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\QuoteRequest;
use App\Models\Setting;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;

/**
 * Translates Eloquent models (snake_case columns) into the exact camelCase
 * shapes frontend/lib/types.ts declares. Every API response goes through here
 * so the wire contract lives in one file instead of being re-derived in each
 * controller.
 */
class Present
{
    /** ISO-8601 in UTC, matching the strings the frontend used to get from the mock seed. */
    public static function date(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return $value instanceof \DateTimeInterface
            ? $value->format('Y-m-d\TH:i:s.v\Z')
            : (string) $value;
    }

    public static function warehouse(Warehouse $w): array
    {
        return [
            'id' => $w->id,
            'name' => $w->name,
            'city' => $w->city,
            'address' => $w->address,
            'capacity' => (int) $w->capacity,
        ];
    }

    public static function category(Category $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'parentId' => $c->parent_id,
        ];
    }

    public static function supplier(Supplier $s): array
    {
        return [
            'id' => $s->id,
            'name' => $s->name,
            'contactName' => $s->contact_name,
            'email' => $s->email,
            'phone' => $s->phone,
            'city' => $s->city,
        ];
    }

    public static function user(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $u->role,
            'initials' => $u->initials,
            'mustChangePassword' => $u->must_change_password,
        ];
    }

    public static function product(Product $p): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'sku' => $p->sku,
            'barcode' => $p->barcode,
            'categoryId' => $p->category_id,
            'brand' => $p->brand,
            'unit' => $p->unit,
            'purchasePrice' => (float) $p->purchase_price,
            'salePrice' => (float) $p->sale_price,
            'minStock' => (int) $p->min_stock,
            'maxStock' => (int) $p->max_stock,
            'status' => $p->status,
            'supplierId' => $p->supplier_id,
            'imageUrl' => $p->image_url,
        ];
    }

    public static function stockLevel(StockLevel $l): array
    {
        return [
            'productId' => $l->product_id,
            'warehouseId' => $l->warehouse_id,
            'quantity' => (int) $l->quantity,
        ];
    }

    public static function movement(StockMovement $m): array
    {
        return array_filter([
            'id' => $m->id,
            'type' => $m->type,
            'productId' => $m->product_id,
            'warehouseId' => $m->warehouse_id,
            'targetWarehouseId' => $m->target_warehouse_id,
            'quantity' => (int) $m->quantity,
            'previousQuantity' => (int) $m->previous_quantity,
            'newQuantity' => (int) $m->new_quantity,
            'reason' => $m->reason,
            'supplierId' => $m->supplier_id,
            'purchaseOrderId' => $m->purchase_order_id,
            'userId' => $m->user_id,
            'note' => $m->note,
            'createdAt' => self::date($m->created_at),
        ], fn ($v) => $v !== null);
    }

    public static function poItem(PurchaseOrderItem $i): array
    {
        return [
            'productId' => $i->product_id,
            'quantity' => (int) $i->quantity,
            'unitPrice' => (float) $i->unit_price,
            'receivedQuantity' => (int) $i->received_quantity,
        ];
    }

    public static function purchaseOrder(PurchaseOrder $po): array
    {
        return array_filter([
            'id' => $po->id,
            'code' => $po->code,
            'supplierId' => $po->supplier_id,
            'warehouseId' => $po->warehouse_id,
            'status' => $po->status,
            'priority' => $po->priority,
            'items' => $po->relationLoaded('items')
                ? $po->items->map(fn ($i) => self::poItem($i))->all()
                : [],
            'createdAt' => self::date($po->created_at),
            'expectedAt' => self::date($po->expected_at),
            'receivedAt' => self::date($po->received_at),
            'currency' => $po->currency,
            'notes' => $po->notes,
        ], fn ($v) => $v !== null);
    }

    public static function quoteRequest(QuoteRequest $q): array
    {
        return array_filter([
            'id' => $q->id,
            'code' => $q->code,
            'supplierId' => $q->supplier_id,
            'purchaseOrderIds' => $q->relationLoaded('items')
                ? array_values(array_unique($q->items->pluck('purchase_order_id')->all()))
                : [],
            'items' => $q->relationLoaded('items')
                ? $q->items->map(fn ($i) => [
                    'purchaseOrderId' => $i->purchase_order_id,
                    'productId' => $i->product_id,
                    'quantity' => (int) $i->quantity,
                    'unitPrice' => (float) $i->unit_price,
                ])->all()
                : [],
            'createdAt' => self::date($q->created_at),
            'createdBy' => $q->created_by,
            'validUntil' => self::date($q->valid_until),
            'deliveryDate' => self::date($q->delivery_date),
            'deliveryAddress' => $q->delivery_address,
            'paymentTerms' => $q->payment_terms,
            'requestedCurrency' => $q->requested_currency,
            'contactName' => $q->contact_name,
            'contactEmail' => $q->contact_email,
            'contactPhone' => $q->contact_phone,
            'notes' => $q->notes,
        ], fn ($v) => $v !== null);
    }

    public static function settings(Setting $s): array
    {
        return [
            'company' => [
                'companyName' => $s->company_name,
                'taxOffice' => $s->tax_office,
                'taxNumber' => $s->tax_number,
                'address' => $s->address,
            ],
            'notifications' => [
                'notifyStock' => (bool) $s->notify_stock,
                'notifyOrder' => (bool) $s->notify_order,
                'notifySystem' => (bool) $s->notify_system,
            ],
            'timezone' => $s->timezone,
            'showKurus' => (bool) $s->show_kurus,
            'defaultRange' => $s->default_range,
        ];
    }
}
