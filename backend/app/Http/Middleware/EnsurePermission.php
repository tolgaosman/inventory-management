<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;

/**
 * Route middleware: ->middleware('perm:purchase.manage'). Mirrors
 * frontend/lib/auth.tsx's can(permission) check, but enforced server-side —
 * the frontend only uses its copy to hide UI, never to gate the request itself.
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission)
    {
        $user = $request->user();

        if (! $user) {
            throw ApiException::forbidden('Oturum bulunamadı, lütfen giriş yapın.');
        }

        $permissions = explode('|', $permission);
        $hasPermission = false;
        foreach ($permissions as $p) {
            if ($user->can($p)) {
                $hasPermission = true;
                break;
            }
        }

        if (! $hasPermission) {
            throw ApiException::forbidden('Bu işlem için yetkiniz yok.');
        }

        return $next($request);
    }
}
