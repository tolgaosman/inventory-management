<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Every soft-deleted table's default Eloquent scope filters
        // `WHERE deleted_at IS NULL` on every single query — none of them had
        // an index on that column.
        foreach ([
            'users',
            'categories',
            'products',
            'suppliers',
            'warehouses',
            'purchase_orders',
            'quote_requests',
            'stock_movements',
        ] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->index('deleted_at');
            });
        }

        Schema::table('products', function (Blueprint $table) {
            $table->index('category_id');
            $table->index('supplier_id');
            $table->index('status');
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            // warehouse_id already has its own index (create_stock_movements_table
            // migration); target_warehouse_id is used in the same `orWhere` for a
            // warehouse's incoming transfers but never had one.
            $table->index('target_warehouse_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach ([
            'users',
            'categories',
            'products',
            'suppliers',
            'warehouses',
            'purchase_orders',
            'quote_requests',
            'stock_movements',
        ] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $table->dropIndex("{$tableName}_deleted_at_index");
            });
        }

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['category_id']);
            $table->dropIndex(['supplier_id']);
            $table->dropIndex(['status']);
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropIndex(['target_warehouse_id']);
        });
    }
};
