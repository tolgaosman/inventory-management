<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;

/**
 * Applied to the whole auth:sanctum group. A freshly admin-created account
 * starts with a known, shared default password (see UserController::store) —
 * this blocks every other endpoint until the user sets their own, so the
 * shared password is never a usable long-term credential.
 */
class EnsurePasswordChanged
{
    /** Reachable while must_change_password is still true. */
    private const EXEMPT_PATHS = [
        'api/auth/me',
        'api/auth/logout',
        'api/auth/change-password',
    ];

    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user?->must_change_password && ! $request->is(...self::EXEMPT_PATHS)) {
            throw ApiException::passwordChangeRequired('Devam etmeden önce şifrenizi değiştirmelisiniz.');
        }

        return $next($request);
    }
}
