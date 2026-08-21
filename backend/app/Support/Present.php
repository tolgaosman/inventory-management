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
            'deletedAt' => self::date($w->deleted_at ?? null),
        ];
    }

    public static function category(Category $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'parentId' => $c->parent_id,
            'deletedAt' => self::date($c->deleted_at ?? null),
        ];
    }

    public static function supplier(Supplier $s): array
    {
        return [
            'id' => $s->id,
            'name' => $s->name,
            'contactName' => $s->contact_name,
            'emails' => $s->emails ?? [],
            'phone' => $s->phone,
            'city' => $s->city,
            'deletedAt' => self::date($s->deleted_at ?? null),
        ];
    }

    public static function user(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'phone' => $u->phone,
            'role' => $u->role,
            'initials' => $u->initials,
            'mustChangePassword' => $u->must_change_password,
            'deletedAt' => self::date($u->deleted_at ?? null),
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
            'purchasePrice' => $p->purchase_price !== null ? (float) $p->purchase_price : null,
            'salePrice' => $p->sale_price !== null ? (float) $p->sale_price : null,
            'minStock' => (int) $p->min_stock,
            'maxStock' => (int) $p->max_stock,
            'status' => $p->status,
            'supplierId' => $p->supplier_id,
            'imageUrl' => $p->image_url,
            'deletedAt' => self::date($p->deleted_at ?? null),
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
            // Present the acting user's name directly rather than making every
            // caller cross-reference a separately-fetched (often permission- or
            // department-scoped, see UserController::index) user list — that
            // list frequently doesn't include the user who performed a given
            // movement, which showed as a blank "kim tarafından yapıldı" cell.
            'userName' => $m->relationLoaded('user') ? ($m->user->name ?? null) : null,
            'note' => $m->note,
            'createdAt' => self::date($m->created_at),
            'deletedAt' => self::date($m->deleted_at ?? null),
        ], fn ($v) => $v !== null);
    }

    public static function poItem(PurchaseOrderItem $i): array
    {
        return [
            'id' => $i->id,
            'productId' => $i->product_id,
            'productName' => $i->product_name,
            'unit' => $i->unit,
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
            'adhocSupplierName' => $po->adhoc_supplier_name,
            'adhocSupplierEmail' => $po->adhoc_supplier_email,
            'warehouseId' => $po->warehouse_id,
            'status' => $po->status,
            'priority' => $po->priority,
            'items' => $po->relationLoaded('items')
                ? $po->items->map(fn ($i) => self::poItem($i))->all()
                : [],
            'createdAt' => self::date($po->created_at),
            'expectedAt' => self::date($po->expected_at),
            'receivedAt' => self::date($po->received_at),
            'rejectionReason' => $po->rejection_reason,
            'currency' => $po->currency,
            'notes' => $po->notes,
            'createdById' => $po->created_by,
            'createdBy' => $po->relationLoaded('createdByUser') ? ($po->createdByUser->name ?? null) : null,
            'approvedBy' => $po->relationLoaded('approvedByUser') ? ($po->approvedByUser->name ?? null) : null,
            'sharedWith' => $po->shared_with,
            'deletedAt' => self::date($po->deleted_at ?? null),
        ], fn ($v) => $v !== null);
    }

    public static function quoteRequest(QuoteRequest $q): array
    {
        return array_filter([
            'id' => $q->id,
            'code' => $q->code,
            'supplierId' => $q->supplier_id,
            'adhocSupplierName' => $q->adhoc_supplier_name,
            'adhocSupplierEmail' => $q->adhoc_supplier_email,
            'items' => $q->relationLoaded('items')
                ? $q->items->map(fn ($i) => [
                    'productId' => $i->product_id,
                    'productName' => $i->product_name,
                    'unit' => $i->unit,
                    'quantity' => (int) $i->quantity,
                    'unitPrice' => $i->unit_price !== null ? (float) $i->unit_price : null,
                ])->all()
                : [],
            'createdAt' => self::date($q->created_at),
            'createdById' => $q->created_by,
            'createdBy' => $q->relationLoaded('createdByUser') ? ($q->createdByUser->name ?? null) : null,
            'createdByUser' => $q->relationLoaded('createdByUser') && $q->createdByUser ? self::user($q->createdByUser) : null,
            'validUntil' => self::date($q->valid_until),
            'deliveryDate' => self::date($q->delivery_date),
            'deliveryAddress' => $q->delivery_address,
            'paymentTerms' => $q->payment_terms,
            'requestedCurrency' => $q->requested_currency,
            'contactName' => $q->contact_name,
            'contactEmail' => $q->contact_email,
            'contactPhone' => $q->contact_phone,
            'notes' => $q->notes,
            'status' => $q->status,
            'approvedBy' => $q->relationLoaded('approvedByUser') ? ($q->approvedByUser->name ?? null) : $q->approved_by,
            'approvedByUser' => $q->relationLoaded('approvedByUser') && $q->approvedByUser ? self::user($q->approvedByUser) : null,
            'approvedAt' => self::date($q->approved_at),
            'deletedAt' => self::date($q->deleted_at ?? null),
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
