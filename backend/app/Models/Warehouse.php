<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Warehouse extends Model
{
    use HasFactory;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'city', 'address', 'capacity'];

    protected $casts = ['capacity' => 'integer'];

    public function stockLevels()
    {
        return $this->hasMany(StockLevel::class);
    }
}
