<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Maps a client-supplied idempotency key to the movement it created. */
class IdempotencyKey extends Model
{
    protected $fillable = ['key', 'movement_id'];

    public function movement()
    {
        return $this->belongsTo(StockMovement::class, 'movement_id');
    }
}
