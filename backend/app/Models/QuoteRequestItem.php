<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuoteRequestItem extends Model
{
    /** The table is a plain snapshot of quote lines — it has no timestamp columns. */
    public $timestamps = false;

    protected $fillable = ['quote_request_id', 'purchase_order_id', 'product_id', 'quantity', 'unit_price'];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
    ];

    public function quoteRequest()
    {
        return $this->belongsTo(QuoteRequest::class);
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
