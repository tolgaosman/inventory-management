<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Replacement for JsonStore::nextId() now that ids live in real tables.
 * Always derives the next id from MAX(numeric suffix) rather than row count,
 * so deleting a row and creating a new one never reuses an id (see old
 * WarehouseController/SupplierController bug where 'wh-'.(count()+1) collided
 * with a previously-deleted row's id).
 */
class IdGenerator
{
    /** Generate the next sequential id for a table, e.g. nextId('warehouses', 'id', 'wh', 0) => "wh-8". */
    public static function nextId(string $table, string $idColumn, string $prefix, int $pad = 0): string
    {
        $max = 0;
        $ids = DB::table($table)->pluck($idColumn);
        foreach ($ids as $id) {
            if (preg_match('/^'.preg_quote($prefix, '/').'-(\d+)$/', (string) $id, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }
        $next = $max + 1;

        return $pad > 0 ? sprintf('%s-%0'.$pad.'d', $prefix, $next) : "{$prefix}-{$next}";
    }

    /**
     * Generate the next sequential "code" of the form {prefix}{year}{NNNN}, e.g.
     * NET-PO-20260042. The numeric counter is derived from the last $pad digits
     * of every existing code (regardless of year) so it never resets on Jan 1 —
     * two orders created in different years never collide on the same suffix.
     */
    public static function nextCode(string $table, string $codeColumn, string $codePrefix, int $pad = 4): string
    {
        $max = 0;
        $codes = DB::table($table)->pluck($codeColumn);
        foreach ($codes as $code) {
            $code = (string) $code;
            if (! str_starts_with($code, $codePrefix)) {
                continue;
            }
            $suffix = substr($code, -$pad);
            if (ctype_digit($suffix)) {
                $max = max($max, (int) $suffix);
            }
        }
        $next = $max + 1;

        return $codePrefix.date('Y').sprintf('%0'.$pad.'d', $next);
    }
}
