<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\EnsurePermission;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \App\Http\Middleware\ForceJsonResponse::class,
            \App\Http\Middleware\SecurityHeaders::class,
        ]);
        $middleware->alias([
            'perm' => EnsurePermission::class,
            'admin' => EnsureAdmin::class,
        ]);
        // Needed so request->secure()/URL::forceScheme() read the real scheme
        // from X-Forwarded-Proto when the app sits behind a reverse proxy/LB.
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ApiException $e, Request $request) {
            return response()->json(['message' => $e->getMessage(), 'code' => $e->errorCode], $e->status());
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            $first = collect($e->errors())->flatten()->first() ?? $e->getMessage();
            return response()->json(['message' => $first, 'code' => 'VALIDATION'], 422);
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            return response()->json(['message' => 'Oturum bulunamadı, lütfen giriş yapın.', 'code' => 'FORBIDDEN'], 401);
        });

        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            return response()->json(['message' => 'Bu işlem için yetkiniz yok.', 'code' => 'FORBIDDEN'], 403);
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            $retryAfter = $e->getHeaders()['Retry-After'] ?? null;
            $suffix = $retryAfter ? " {$retryAfter} saniye sonra tekrar deneyin." : '';

            return response()->json([
                'message' => "Çok fazla deneme yaptınız.{$suffix}",
                'code' => 'VALIDATION',
            ], 429, $e->getHeaders());
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            return response()->json(['message' => 'Kaynak bulunamadı.', 'code' => 'NOT_FOUND'], 404);
        });

        // Catch-all for anything not matched above (QueryException, TypeError,
        // a third-party package's exception, ...). Without this, an unhandled
        // Throwable falls through to Laravel's default handler, which — if
        // APP_DEBUG is ever left true in production — dumps the raw message,
        // file path and stack trace as JSON. In local dev (debug on) we still
        // want the real detail, so only the non-debug path is overridden here.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*') || app()->hasDebugModeEnabled()) {
                return null;
            }

            return response()->json(['message' => 'Sunucu hatası oluştu.', 'code' => 'UNKNOWN'], 500);
        });
    })->create();
