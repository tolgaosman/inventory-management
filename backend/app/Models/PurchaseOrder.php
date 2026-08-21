<?php

namespace App\Models;

use App\Models\Concerns\TracksDeletedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model
{
        use SoftDeletes;
use TracksDeletedBy;

public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'code', 'supplier_id', 'adhoc_supplier_name', 'adhoc_supplier_email', 'warehouse_id', 'status', 'priority',
        'created_at', 'expected_at', 'received_at', 'currency', 'notes', 'invoice_file_path',
        'created_by', 'approved_by', 'rejection_reason', 'shared_with',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'expected_at' => 'datetime',
        'received_at' => 'datetime',
        'shared_with' => 'array',
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

    public function createdByUser()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedByUser()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
