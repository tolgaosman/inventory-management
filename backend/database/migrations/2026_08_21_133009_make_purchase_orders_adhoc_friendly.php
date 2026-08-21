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
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('supplier_id')->nullable()->change();
            $table->string('warehouse_id')->nullable()->change();
            $table->string('adhoc_supplier_name')->nullable()->after('supplier_id');
            $table->string('adhoc_supplier_email')->nullable()->after('adhoc_supplier_name');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->string('product_id')->nullable()->change();
            $table->string('product_name')->nullable()->after('product_id');
            $table->string('unit')->nullable()->after('product_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn(['product_name', 'unit']);
            $table->string('product_id')->nullable(false)->change();
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['adhoc_supplier_name', 'adhoc_supplier_email']);
            $table->string('supplier_id')->nullable(false)->change();
            $table->string('warehouse_id')->nullable(false)->change();
        });
    }
};
