<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Quote requests (teklif) no longer have to be derived from an existing
 * purchase order — a buyer can now RFQ a supplier (existing or brand new,
 * name-only) for items that don't have a draft order yet, and only place the
 * real purchase order once the supplier responds with pricing. This drops the
 * hard dependency on purchase_orders/products for both tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quote_requests', function (Blueprint $table) {
            $table->dropForeign(['supplier_id']);
        });
        Schema::table('quote_requests', function (Blueprint $table) {
            $table->string('supplier_id')->nullable()->change();
            $table->string('adhoc_supplier_name')->nullable()->after('supplier_id');
            $table->foreign('supplier_id')->references('id')->on('suppliers')->restrictOnDelete();
        });

        Schema::table('quote_request_items', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_id']);
            $table->dropForeign(['product_id']);
        });
        Schema::table('quote_request_items', function (Blueprint $table) {
            $table->string('purchase_order_id')->nullable()->change();
            $table->string('product_id')->nullable()->change();
            $table->decimal('unit_price', 12, 2)->nullable()->change();
            $table->string('product_name')->nullable()->after('product_id');
            $table->string('unit')->nullable()->after('product_name');
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->restrictOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
        });

        // Backfill existing rows so `product_name`/`unit` are always populated
        // going forward, matching the new "always denormalized" contract.
        // A plain per-row loop (rather than an UPDATE...JOIN) keeps this
        // portable across the MySQL dev DB and the SQLite test DB.
        $productsById = DB::table('products')->get(['id', 'name', 'unit'])->keyBy('id');

        foreach (DB::table('quote_request_items')->whereNotNull('product_id')->get(['id', 'product_id']) as $row) {
            $product = $productsById->get($row->product_id);
            if (! $product) {
                continue;
            }
            DB::table('quote_request_items')->where('id', $row->id)->update([
                'product_name' => $product->name,
                'unit' => $product->unit,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('quote_request_items', function (Blueprint $table) {
            $table->dropColumn(['product_name', 'unit']);
        });
        Schema::table('quote_requests', function (Blueprint $table) {
            $table->dropColumn('adhoc_supplier_name');
        });
    }
};
