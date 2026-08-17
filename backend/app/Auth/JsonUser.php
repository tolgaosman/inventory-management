<?php

namespace App\Auth;

use Illuminate\Contracts\Auth\Authenticatable;

/**
 * Lightweight Authenticatable wrapper around a row from users.json. There is
 * no Eloquent model backing this — the whole app is deliberately DB-free.
 */
class JsonUser implements Authenticatable
{
    /** @param array<string, mixed> $attributes */
    public function __construct(public array $attributes)
    {
    }

    public function id(): string
    {
        return $this->attributes['id'];
    }

    public function role(): string
    {
        return $this->attributes['role'];
    }

    public function can(string $permission): bool
    {
        return in_array($permission, config("permissions.role_permissions.{$this->role()}", []), true);
    }

    public function toArray(): array
    {
        return [
            'id' => $this->attributes['id'],
            'name' => $this->attributes['name'],
            'email' => $this->attributes['email'],
            'role' => $this->attributes['role'],
            'initials' => $this->attributes['initials'],
        ];
    }

    public function getAuthIdentifierName()
    {
        return 'id';
    }

    public function getAuthIdentifier()
    {
        return $this->attributes['id'];
    }

    public function getAuthPasswordName()
    {
        return 'password_hash';
    }

    public function getAuthPassword()
    {
        return $this->attributes['password_hash'] ?? '';
    }

    public function getRememberToken()
    {
        return null;
    }

    public function setRememberToken($value)
    {
        // not used
    }

    public function getRememberTokenName()
    {
        return '';
    }
}
