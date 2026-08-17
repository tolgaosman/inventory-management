<?php

namespace App\Auth;

use App\Support\JsonStore;
use Illuminate\Support\Str;

/**
 * Hand-rolled bearer token store (tokens.json) standing in for Sanctum, since
 * Sanctum's HasApiTokens trait assumes an Eloquent-backed users table and this
 * app has none. Behavior is the same: opaque bearer token -> user id lookup.
 */
class AuthTokenService
{
    public function __construct(private JsonStore $store)
    {
    }

    public function issue(string $userId): string
    {
        $token = Str::random(64);
        $tokens = $this->store->read('tokens');
        $tokens[] = [
            'token' => hash('sha256', $token),
            'user_id' => $userId,
            'created_at' => now()->toIso8601String(),
        ];
        $this->store->write('tokens', $tokens);

        return $token;
    }

    public function resolveUserId(string $plainToken): ?string
    {
        $hash = hash('sha256', $plainToken);
        foreach ($this->store->read('tokens') as $row) {
            if (hash_equals($row['token'], $hash)) {
                return $row['user_id'];
            }
        }

        return null;
    }

    public function revoke(string $plainToken): void
    {
        $hash = hash('sha256', $plainToken);
        $tokens = $this->store->read('tokens');
        $tokens = array_values(array_filter($tokens, fn ($row) => ! hash_equals($row['token'], $hash)));
        $this->store->write('tokens', $tokens);
    }
}
