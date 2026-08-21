<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('sale_price');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('purchase_price', 12, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('purchase_price', 12, 2)->nullable(false)->change();
        });
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('sale_price', 12, 2)->default(0)->after('purchase_price');
        });
    }
};
