<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Grants every existing role the full dashboard permission set.
 *
 * The /panel page used to be gated by products.view, so anyone who could see
 * products saw the whole dashboard. Backfilling everything keeps that behaviour
 * intact; admins narrow it down per role from the Roller page afterwards.
 */
return new class extends Migration
{
    /** @return string[] */
    private function keys(): array
    {
        return array_values(array_filter(
            config('permissions.permissions'),
            fn ($p) => str_starts_with($p, 'dashboard.')
        ));
    }

    public function up(): void
    {
        $keys = $this->keys();
        $roleIds = DB::table('roles')->pluck('id');

        $rows = [];
        foreach ($roleIds as $roleId) {
            foreach ($keys as $key) {
                $rows[] = ['role_id' => $roleId, 'permission' => $key];
            }
        }

        if ($rows !== []) {
            DB::table('role_permissions')->insertOrIgnore($rows);
        }
    }

    public function down(): void
    {
        DB::table('role_permissions')->whereIn('permission', $this->keys())->delete();
    }
};
