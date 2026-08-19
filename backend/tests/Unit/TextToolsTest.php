<?php

namespace Tests\Unit;

use App\Support\TextTools;
use PHPUnit\Framework\TestCase;

class TextToolsTest extends TestCase
{
    public function test_normalize_folds_turkish_diacritics_to_ascii(): void
    {
        $this->assertSame('istanbul', TextTools::normalize('İstanbul'));
        $this->assertSame('gozluk', TextTools::normalize('Gözlük'));
        $this->assertSame('cay seti', TextTools::normalize('Çay Şeti'));
    }

    public function test_matches_finds_a_diacritic_insensitive_substring(): void
    {
        $this->assertTrue(TextTools::matches(['Gözlük Çerçevesi'], 'gozluk'));
        $this->assertTrue(TextTools::matches(['Gözlük Çerçevesi'], 'çerçeve'));
        $this->assertFalse(TextTools::matches(['Gözlük Çerçevesi'], 'kalem'));
    }

    public function test_matches_treats_a_blank_term_as_always_matching(): void
    {
        $this->assertTrue(TextTools::matches(['Herhangi bir şey'], ''));
        $this->assertTrue(TextTools::matches(['Herhangi bir şey'], null));
        $this->assertTrue(TextTools::matches(['Herhangi bir şey'], '   '));
    }

    public function test_matches_ignores_null_haystack_entries(): void
    {
        $this->assertTrue(TextTools::matches([null, 'Aranan Değer'], 'aranan'));
        $this->assertFalse(TextTools::matches([null, null], 'aranan'));
    }

    public function test_paginate_slices_rows_and_reports_the_total(): void
    {
        $rows = array_map(fn ($i) => ['id' => $i], range(1, 25));

        $page2 = TextTools::paginate($rows, 2, 10);

        $this->assertCount(10, $page2['rows']);
        $this->assertSame(11, $page2['rows'][0]['id']);
        $this->assertSame(25, $page2['total']);
        $this->assertSame(2, $page2['page']);
    }

    public function test_paginate_clamps_page_and_page_size_to_at_least_one(): void
    {
        $rows = [['id' => 1], ['id' => 2]];

        $result = TextTools::paginate($rows, 0, 0);

        $this->assertSame(1, $result['page']);
        $this->assertSame(1, $result['pageSize']);
        $this->assertCount(1, $result['rows']);
    }
}
