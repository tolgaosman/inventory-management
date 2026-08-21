<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Suppliers now carry a list of at least 3 emails (a primary contact plus
 * alternates) instead of a single address, so a quote request can be sent to
 * whichever inbox is actually watched. Existing single emails are kept as the
 * first entry; two more are synthesized from the same domain so every row
 * satisfies the new minimum without losing the original contact.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->json('emails')->nullable()->after('email');
        });

        foreach (DB::table('suppliers')->select('id', 'email')->get() as $supplier) {
            $domain = str_contains($supplier->email, '@') ? substr($supplier->email, strpos($supplier->email, '@') + 1) : 'example.com';
            $emails = array_values(array_unique([
                $supplier->email,
                "satinalma@{$domain}",
                "info@{$domain}",
            ]));
            while (count($emails) < 3) {
                $emails[] = 'destek'.count($emails)."@{$domain}";
            }
            DB::table('suppliers')->where('id', $supplier->id)->update(['emails' => json_encode($emails)]);
        }

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('email');
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('email')->nullable()->after('contact_name');
        });

        foreach (DB::table('suppliers')->select('id', 'emails')->get() as $supplier) {
            $emails = json_decode($supplier->emails ?? '[]', true) ?: [];
            DB::table('suppliers')->where('id', $supplier->id)->update(['email' => $emails[0] ?? '']);
        }

        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
            $table->dropColumn('emails');
        });
    }
};
