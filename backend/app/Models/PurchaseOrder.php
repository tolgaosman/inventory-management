<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'code', 'supplier_id', 'warehouse_id', 'status', 'priority',
        'created_at', 'expected_at', 'received_at', 'currency', 'notes', 'invoice_file_path',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'expected_at' => 'datetime',
        'received_at' => 'datetime',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function items()
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }
}
