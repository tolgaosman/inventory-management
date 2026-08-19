<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Singleton row (id = 1) — company profile + notification defaults. */
class Setting extends Model
{
    protected $fillable = [
        'company_name', 'tax_office', 'tax_number', 'address',
        'notify_stock', 'notify_order', 'notify_system',
        'timezone', 'show_kurus', 'default_range',
    ];

    protected $casts = [
        'notify_stock' => 'boolean',
        'notify_order' => 'boolean',
        'notify_system' => 'boolean',
        'show_kurus' => 'boolean',
    ];

    public static function singleton(): self
    {
        return static::firstOrCreate(['id' => 1], [
            'company_name' => 'Near East Technology',
            'tax_office' => 'Lefkoşa Vergi Dairesi',
            'tax_number' => '1234567890',
            'address' => 'Yakın Doğu Bulvarı No:1, Lefkoşa, KKTC',
        ]);
    }
}
