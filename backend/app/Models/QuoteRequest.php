<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuoteRequest extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'id', 'code', 'supplier_id', 'created_at', 'created_by',
        'valid_until', 'delivery_date', 'delivery_address', 'payment_terms',
        'requested_currency', 'contact_name', 'contact_email', 'contact_phone', 'notes',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'valid_until' => 'datetime',
        'delivery_date' => 'datetime',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function createdByUser()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items()
    {
        return $this->hasMany(QuoteRequestItem::class);
    }
}
