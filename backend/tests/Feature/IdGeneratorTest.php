<?php

namespace Tests\Feature;

use App\Models\Supplier;
use App\Models\Warehouse;
use App\Support\IdGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class IdGeneratorTest extends TestCase
{
    use RefreshDatabase;

    public function test_next_id_starts_at_one_for_an_empty_table(): void
    {
        $this->assertSame('wh-1', IdGenerator::nextId('warehouses', 'id', 'wh'));
    }

    public function test_next_id_does_not_collide_with_a_surviving_row_after_a_middle_row_is_deleted(): void
    {
        // Reproduces the old JsonStore bug: id = prefix.(count()+1). With
        // wh-1, wh-2, wh-3 and wh-2 deleted, count() drops to 2, so the old
        // formula produced "wh-3" — colliding with the still-existing wh-3.
        // MAX-based generation must skip past every id that still exists.
        Warehouse::factory()->create(['id' => 'wh-1']);
        Warehouse::factory()->create(['id' => 'wh-2']);
        Warehouse::factory()->create(['id' => 'wh-3']);
        Warehouse::query()->where('id', 'wh-2')->delete();

        $this->assertSame('wh-4', IdGenerator::nextId('warehouses', 'id', 'wh'));
    }

    public function test_next_code_never_resets_across_years(): void
    {
        DB::table('purchase_orders')->insert($this->minimalOrder('po-1', 'NET-PO-20250099'));

        $code = IdGenerator::nextCode('purchase_orders', 'code', 'NET-PO-');

        $this->assertSame('NET-PO-'.date('Y').'0100', $code);
    }

    /** @return array<string, mixed> */
    private function minimalOrder(string $id, string $code): array
    {
        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();

        return [
            'id' => $id,
            'code' => $code,
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
            'status' => 'draft',
            'priority' => 'medium',
            'created_at' => now(),
            'expected_at' => now()->addDays(7),
            'currency' => 'TRY',
        ];
    }
}
