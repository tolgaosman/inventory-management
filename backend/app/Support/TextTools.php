<?php

namespace App\Support;

/**
 * PHP port of frontend/lib/api/client.ts's normalizeSearchString / matchesSearch,
 * plus the pagination envelope and tr-TR-ish sort used throughout the mock API.
 * Frontend contract: PagedResult is {rows, total, page, pageSize} — not
 * Laravel's default {data, links, meta} — so paginate() must return exactly that.
 */
class TextTools
{
    public static function normalize(string $str): string
    {
        // Map Turkish letters (both cases) to ascii *before* lowercasing —
        // mb_strtolower('İ') decomposes to "i" + a combining dot above
        // (U+0307), which the old post-lowercase map never matched, so any
        // search containing a capital İ (İstanbul, İzmir, ...) silently failed.
        $map = [
            'İ' => 'i', 'I' => 'i', 'ı' => 'i',
            'Ğ' => 'g', 'ğ' => 'g',
            'Ü' => 'u', 'ü' => 'u',
            'Ş' => 's', 'ş' => 's',
            'Ö' => 'o', 'ö' => 'o',
            'Ç' => 'c', 'ç' => 'c',
        ];

        return mb_strtolower(strtr($str, $map), 'UTF-8');
    }

    /** @param array<int, string|null> $haystacks */
    public static function matches(array $haystacks, ?string $term): bool
    {
        $term = $term === null ? null : trim($term);
        if ($term === null || $term === '') {
            return true;
        }

        $needleLower = mb_strtolower($term, 'UTF-8');
        $needleNorm = self::normalize($term);

        foreach ($haystacks as $h) {
            if ($h === null || $h === '') {
                continue;
            }
            $hLower = mb_strtolower($h, 'UTF-8');
            if (str_contains($hLower, $needleLower) || str_contains(self::normalize($h), $needleNorm)) {
                return true;
            }
        }

        return false;
    }

    /** Turkish-aware comparator; falls back to normalized ascii comparison if intl is unavailable. */
    public static function compare(string $a, string $b): int
    {
        if (class_exists(\Collator::class)) {
            static $collator = null;
            $collator ??= new \Collator('tr_TR');
            $result = $collator->compare($a, $b);

            return $result === false ? strcmp(self::normalize($a), self::normalize($b)) : $result;
        }

        return strcmp(self::normalize($a), self::normalize($b));
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array{rows: array<int, array<string, mixed>>, total: int, page: int, pageSize: int}
     */
    public static function paginate(array $rows, int $page = 1, int $pageSize = 10): array
    {
        $page = max(1, $page);
        $pageSize = max(1, $pageSize);
        $total = count($rows);
        $start = ($page - 1) * $pageSize;

        return [
            'rows' => array_slice(array_values($rows), $start, $pageSize),
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
        ];
    }
}
