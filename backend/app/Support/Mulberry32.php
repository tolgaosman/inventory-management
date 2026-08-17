<?php

namespace App\Support;

/**
 * PHP port of frontend/lib/mock/seed.ts's mulberry32 PRNG, kept bit-for-bit
 * equivalent (all intermediate values stay in 0..0xFFFFFFFF, mirroring how
 * JS's bitwise ops implicitly work mod 2^32) so the seeded data this backend
 * generates is deterministic run-to-run just like the frontend mock is.
 */
class Mulberry32
{
    private int $a;

    public function __construct(int $seed)
    {
        $this->a = $seed & 0xFFFFFFFF;
    }

    public function next(): float
    {
        $this->a = ($this->a + 0x6d2b79f5) & 0xFFFFFFFF;
        $a = $this->a;

        $x = ($a ^ ($a >> 15)) & 0xFFFFFFFF;
        $y = (1 | $a) & 0xFFFFFFFF;
        $t = ($x * $y) & 0xFFFFFFFF;

        $x2 = ($t ^ ($t >> 7)) & 0xFFFFFFFF;
        $y2 = (61 | $t) & 0xFFFFFFFF;
        $t2 = (($t + (($x2 * $y2) & 0xFFFFFFFF)) & 0xFFFFFFFF) ^ $t;
        $t2 &= 0xFFFFFFFF;

        return (($t2 ^ ($t2 >> 14)) & 0xFFFFFFFF) / 4294967296;
    }

    /** @param array<int, mixed> $items */
    public function pick(array $items): mixed
    {
        $items = array_values($items);

        return $items[(int) floor($this->next() * count($items))];
    }

    public function int(int $min, int $max): int
    {
        return (int) floor($this->next() * ($max - $min + 1)) + $min;
    }

    public static function id(string $prefix, int $n): string
    {
        return sprintf('%s-%04d', $prefix, $n);
    }

    /** Fisher-Yates using this generator. Not call-count-identical to JS's Array.sort shuffle, only equally deterministic. */
    public function shuffle(array $items): array
    {
        $items = array_values($items);
        for ($i = count($items) - 1; $i > 0; $i--) {
            $j = (int) floor($this->next() * ($i + 1));
            [$items[$i], $items[$j]] = [$items[$j], $items[$i]];
        }

        return $items;
    }
}
