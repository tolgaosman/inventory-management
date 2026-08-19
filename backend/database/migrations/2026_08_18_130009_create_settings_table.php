<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Singleton row (id = 1 always) — company profile + notification defaults.
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('company_name');
            $table->string('tax_office');
            $table->string('tax_number');
            $table->string('address');
            $table->boolean('notify_stock')->default(true);
            $table->boolean('notify_order')->default(true);
            $table->boolean('notify_system')->default(false);
            $table->string('timezone')->default('Europe/Istanbul');
            $table->boolean('show_kurus')->default(false);
            $table->string('default_range')->default('bu-ay');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
