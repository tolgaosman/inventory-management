<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sale price is back, but only ever shown on the product detail page — the
 * "Ürün Yönetimi" list/management page and its bulk-edit form deliberately
 * never surface it. See ProductFormSheet's `showSalePrice` prop.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('sale_price', 12, 2)->nullable()->after('purchase_price');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('sale_price');
        });
    }
};
