<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\RolePermission;
use App\Models\User;
use App\Support\TextTools;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Admin-only (gated by the `admin` route middleware, not a reassignable permission — see EnsureAdmin). */
class RoleController extends Controller
{
    private function toRow(Role $role): array
    {
        return [
            'id' => $role->id,
            'name' => $role->name,
            'isSystem' => $role->is_system,
            'userCount' => User::query()->where('role', $role->id)->count(),
            'permissions' => $role->permissions->pluck('permission')->values()->all(),
        ];
    }

    public function index()
    {
        $roles = Role::query()->with('permissions')->orderByDesc('is_system')->orderBy('name')->get();

        return response()->json($roles->map(fn (Role $r) => $this->toRow($r))->values()->all());
    }

    private function slugify(string $name): string
    {
        $base = preg_replace('/[^a-z0-9]+/', '_', TextTools::normalize($name));
        $base = trim($base, '_') ?: 'rol';

        $id = $base;
        $suffix = 2;
        while (Role::query()->whereKey($id)->exists()) {
            $id = "{$base}_{$suffix}";
            $suffix++;
        }

        return $id;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string', Rule::in(config('permissions.permissions'))],
        ]);

        $role = DB::transaction(function () use ($data) {
            $role = Role::query()->create([
                'id' => $this->slugify($data['name']),
                'name' => trim($data['name']),
                'is_system' => false,
            ]);

            RolePermission::query()->insert(array_map(
                fn (string $permission) => ['role_id' => $role->id, 'permission' => $permission, 'created_at' => now(), 'updated_at' => now()],
                array_values(array_unique($data['permissions'])),
            ));

            return $role;
        });

        return response()->json($this->toRow($role->fresh('permissions')), 201);
    }

    public function update(Request $request, string $id)
    {
        $role = Role::query()->find($id);
        if (! $role) {
            throw ApiException::notFound('Rol bulunamadı.');
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string', Rule::in(config('permissions.permissions'))],
        ]);

        DB::transaction(function () use ($role, $data) {
            // System roles keep their original name — it's the value stored
            // in users.role and referenced by UserController's department
            // scoping, so it shouldn't drift out from under that logic.
            if (! $role->is_system && array_key_exists('name', $data)) {
                $role->name = trim($data['name']);
                $role->save();
            }

            RolePermission::query()->where('role_id', $role->id)->delete();
            RolePermission::query()->insert(array_map(
                fn (string $permission) => ['role_id' => $role->id, 'permission' => $permission, 'created_at' => now(), 'updated_at' => now()],
                array_values(array_unique($data['permissions'])),
            ));
        });

        return response()->json($this->toRow($role->fresh('permissions')));
    }

    public function destroy(string $id)
    {
        $role = Role::query()->find($id);
        if (! $role) {
            throw ApiException::notFound('Rol bulunamadı.');
        }

        if ($role->is_system) {
            throw ApiException::conflict('Sistem rolleri silinemez.');
        }

        $userCount = User::query()->where('role', $id)->count();
        if ($userCount > 0) {
            throw ApiException::conflict("Bu role sahip {$userCount} kullanıcı olduğu için silinemez.");
        }

        $role->delete();

        return response()->json(['deleted' => true]);
    }
}
