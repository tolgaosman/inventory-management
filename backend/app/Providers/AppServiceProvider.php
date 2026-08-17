<?php

namespace App\Providers;

use App\Auth\AuthTokenService;
use App\Auth\JsonUser;
use App\Support\JsonStore;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(JsonStore::class);
        $this->app->singleton(AuthTokenService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Resolves a bearer token (Authorization: Bearer <token>) against
        // tokens.json and wraps the matching users.json row as a JsonUser.
        Auth::viaRequest('api-token', function ($request) {
            $token = $request->bearerToken();
            if (! $token) {
                return null;
            }

            $userId = $this->app->make(AuthTokenService::class)->resolveUserId($token);
            if (! $userId) {
                return null;
            }

            $store = $this->app->make(JsonStore::class);
            $row = collect($store->read('users'))->firstWhere('id', $userId);

            return $row ? new JsonUser($row) : null;
        });
    }
}
