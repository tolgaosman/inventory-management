<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;

/**
 * Route middleware: ->middleware('admin'). Gates role management specifically
 * to the literal `admin` role rather than a permission — a permission-based
 * gate would let an admin lock themselves out by editing the admin role's own
 * permission set (see RoleController).
 */
class EnsureAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user) {
            throw ApiException::forbidden('Oturum bulunamadı, lütfen giriş yapın.');
        }

        if ($user->role !== 'admin') {
            throw ApiException::forbidden('Bu işlem için yetkiniz yok.');
        }

        return $next($request);
    }
}
