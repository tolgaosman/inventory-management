<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Only takes effect once APP_ENV=production is actually set at deploy
        // time; trustProxies() in bootstrap/app.php makes sure the scheme is
        // read from X-Forwarded-Proto when sitting behind a reverse proxy.
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // Ordinary authenticated writes: generous enough not to bother a real
        // user, tight enough to blunt a scripted abuse burst.
        RateLimiter::for('writes', fn ($request) => Limit::perMinute(60)->by($request->user()?->getKey() ?? $request->ip()));

        // Bulk/import/upload endpoints touch many rows or parse a file per
        // request — worth a tighter ceiling than a single-row write.
        RateLimiter::for('bulk', fn ($request) => Limit::perMinute(10)->by($request->user()?->getKey() ?? $request->ip()));
    }
}
