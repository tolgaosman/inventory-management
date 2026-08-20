<?php

namespace App\Models;

use App\Models\Concerns\TracksDeletedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Warehouse extends Model
{
        use SoftDeletes;
use TracksDeletedBy;

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
