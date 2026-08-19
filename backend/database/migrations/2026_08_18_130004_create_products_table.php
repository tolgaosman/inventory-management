<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->string('id')->primary(); // prd-0001
            $table->string('name');
            $table->string('sku')->unique();
            $table->string('barcode');
            $table->string('category_id');
            $table->string('brand');
            $table->string('unit');
            $table->decimal('purchase_price', 12, 2);
            $table->decimal('sale_price', 12, 2);
            $table->unsignedInteger('min_stock');
            $table->unsignedInteger('max_stock');
            $table->string('status')->default('aktif'); // aktif | pasif
            $table->string('supplier_id');
            $table->string('image_url')->nullable();
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('categories')->restrictOnDelete();
            $table->foreign('supplier_id')->references('id')->on('suppliers')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
