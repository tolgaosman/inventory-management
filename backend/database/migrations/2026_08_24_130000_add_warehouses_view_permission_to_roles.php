<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Introduces 'warehouses.view' as the Depolar page's own master permission.
 *
 * The /depolar page (and its GET /warehouses* endpoints) used to be gated by
 * products.view alone, so anyone who could see products saw the warehouses
 * page too. Backfilling warehouses.view onto every role that already has
 * products.view keeps that behaviour intact; admins can narrow it down per
 * role from the Roller page afterwards. The backend route middleware accepts
 * either permission (products.view|warehouses.view), so this backfill is a
 * UI-accuracy step, not a functional requirement.
 */
return new class extends Migration
{
    public function up(): void
    {
        $roleIds = DB::table('role_permissions')
            ->where('permission', 'products.view')
            ->pluck('role_id');

        $rows = [];
        foreach ($roleIds as $roleId) {
            $rows[] = ['role_id' => $roleId, 'permission' => 'warehouses.view'];
        }

        if ($rows !== []) {
            DB::table('role_permissions')->insertOrIgnore($rows);
        }
    }

    public function down(): void
    {
        DB::table('role_permissions')->where('permission', 'warehouses.view')->delete();
    }
};
