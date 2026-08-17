<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\EnsurePermission;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
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
        ]);
        $middleware->alias([
            'perm' => EnsurePermission::class,
        ]);
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

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            return response()->json(['message' => 'Kaynak bulunamadı.', 'code' => 'NOT_FOUND'], 404);
        });
    })->create();
