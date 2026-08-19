<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'name', 'email', 'role', 'initials', 'password', 'must_change_password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
        ];
    }

    /** @return string[] */
    public function permissions(): array
    {
        return config("permissions.role_permissions.{$this->role}", []);
    }

    public function can($abilities, $arguments = []): bool
    {
        // Overrides Laravel's Gate-based can() with our permission-string model
        // (frontend/lib/auth.tsx's can(permission) — see config/permissions.php).
        return in_array($abilities, $this->permissions(), true);
    }
}
