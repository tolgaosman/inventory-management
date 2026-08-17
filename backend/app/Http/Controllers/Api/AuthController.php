<?php

namespace App\Http\Controllers\Api;

use App\Auth\AuthTokenService;
use App\Auth\JsonUser;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Support\JsonStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function __construct(private JsonStore $store, private AuthTokenService $tokens)
    {
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = collect($this->store->read('users'))
            ->first(fn ($u) => mb_strtolower($u['email']) === mb_strtolower($data['email']));

        if (! $user || ! Hash::check($data['password'], $user['password_hash'] ?? '')) {
            throw ApiException::forbidden('E-posta veya şifre hatalı.');
        }

        $token = $this->tokens->issue($user['id']);

        return response()->json([
            'token' => $token,
            'user' => (new JsonUser($user))->toArray(),
            'permissions' => config("permissions.role_permissions.{$user['role']}", []),
        ]);
    }

    public function logout(Request $request)
    {
        $token = $request->bearerToken();
        if ($token) {
            $this->tokens->revoke($token);
        }

        return response()->json(['message' => 'Çıkış yapıldı.']);
    }

    public function me(Request $request)
    {
        /** @var JsonUser $user */
        $user = $request->user('api-token');

        return response()->json([
            'user' => $user->toArray(),
            'permissions' => config("permissions.role_permissions.{$user->role()}", []),
        ]);
    }
}
