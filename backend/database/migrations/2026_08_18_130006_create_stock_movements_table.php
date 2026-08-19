<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->string('id')->primary(); // mv-0001
            $table->string('type'); // giris | cikis | transfer
            $table->string('product_id');
            $table->string('warehouse_id');
            $table->string('target_warehouse_id')->nullable();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('previous_quantity');
            $table->unsignedInteger('new_quantity');
            $table->string('reason');
            $table->string('supplier_id')->nullable();
            $table->string('purchase_order_id')->nullable();
            $table->string('user_id');
            $table->text('note')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->foreign('warehouse_id')->references('id')->on('warehouses')->restrictOnDelete();
            $table->foreign('target_warehouse_id')->references('id')->on('warehouses')->nullOnDelete();
            $table->foreign('supplier_id')->references('id')->on('suppliers')->nullOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();

            $table->index('product_id');
            $table->index('warehouse_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
