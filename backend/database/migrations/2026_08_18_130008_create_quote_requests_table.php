<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quote_requests', function (Blueprint $table) {
            $table->string('id')->primary(); // qr-0001
            $table->string('code')->unique(); // NET-TKL-{year}{0000}
            $table->string('supplier_id');
            $table->timestamp('created_at')->nullable();
            $table->string('created_by')->nullable();
            $table->timestamp('valid_until')->nullable();
            $table->timestamp('delivery_date')->nullable();
            $table->text('delivery_address');
            $table->string('payment_terms');
            $table->string('requested_currency'); // try|usd|eur|gbp
            $table->string('contact_name');
            $table->string('contact_email');
            $table->string('contact_phone');
            $table->text('notes')->nullable();

            $table->foreign('supplier_id')->references('id')->on('suppliers')->restrictOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('quote_request_items', function (Blueprint $table) {
            $table->id();
            $table->string('quote_request_id');
            $table->string('purchase_order_id');
            $table->string('product_id');
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 12, 2); // price snapshot at request time

            $table->foreign('quote_request_id')->references('id')->on('quote_requests')->cascadeOnDelete();
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->restrictOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_request_items');
        Schema::dropIfExists('quote_requests');
    }
};
