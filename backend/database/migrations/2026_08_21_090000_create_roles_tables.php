<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Moves roles from the static backend/config/permissions.php map to a real
 * table, so admin can create custom roles at runtime. The seed data below is
 * a literal, one-time copy of that config file's role_permissions as of this
 * migration — not a runtime read of the file — so behavior for existing
 * users is unchanged after this runs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->boolean('is_system')->default(false);
            $table->timestamps();
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();
            $table->string('role_id');
            $table->string('permission');
            $table->timestamps();

            $table->unique(['role_id', 'permission']);
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
        });

        $roles = [
            'depo' => 'Depo Personeli',
            'satinalma' => 'Satın Alma Personeli',
            'depo_yonetici' => 'Depo Müdürü',
            'satinalma_yonetici' => 'Satın Alma Müdürü',
            'admin' => 'Admin',
        ];

        $rolePermissions = [
            'depo' => [
                'products.view', 'products.manage',
                'stock.view', 'stock.in', 'stock.out', 'stock.transfer',
                'purchase.view', 'purchase.receive',
                'suppliers.view',
                'financial.view',
            ],
            'satinalma' => [
                'products.view',
                'stock.view',
                'purchase.view', 'purchase.manage',
                'suppliers.view',
                'financial.view',
            ],
            'depo_yonetici' => [
                'products.view', 'products.manage',
                'warehouses.manage',
                'stock.view', 'stock.in', 'stock.out', 'stock.transfer',
                'purchase.view', 'purchase.receive',
                'suppliers.view',
                'reports.stock',
                'financial.view',
                'users.manage',
            ],
            'satinalma_yonetici' => [
                'products.view',
                'stock.view',
                'purchase.view', 'purchase.manage', 'purchase.approve', 'purchase.receive',
                'suppliers.view', 'suppliers.manage',
                'reports.financial',
                'financial.view',
                'users.manage',
            ],
            'admin' => [
                'products.view', 'products.manage',
                'warehouses.manage',
                'stock.view', 'stock.in', 'stock.out', 'stock.transfer',
                'purchase.view', 'purchase.manage', 'purchase.approve', 'purchase.receive',
                'suppliers.view', 'suppliers.manage',
                'reports.stock', 'reports.financial',
                'financial.view',
                'users.manage',
                // Only admin manages roles — see App\Http\Middleware\EnsureAdmin,
                // which is the actual gate; this permission only drives UI hiding.
                'roles.manage',
            ],
        ];

        $now = now();

        foreach ($roles as $id => $name) {
            DB::table('roles')->insert([
                'id' => $id,
                'name' => $name,
                'is_system' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('role_permissions')->insert(array_map(
                fn (string $permission) => [
                    'role_id' => $id,
                    'permission' => $permission,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                $rolePermissions[$id],
            ));
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('roles');
    }
};
