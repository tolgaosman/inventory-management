<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\StockLevel;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockMovementTest extends TestCase
{
    use RefreshDatabase;

    private function depoUser(): User
    {
        return User::factory()->role('depo')->create();
    }

    public function test_stock_in_increases_quantity_and_records_a_movement(): void
    {
        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();

        $response = $this->actingAs($this->depoUser(), 'sanctum')->postJson('/api/stock/in', [
            'warehouseId' => $warehouse->id,
            'productId' => $product->id,
            'quantity' => 25,
        ]);

        $response->assertCreated()
            ->assertJsonPath('type', 'giris')
            ->assertJsonPath('previousQuantity', 0)
            ->assertJsonPath('newQuantity', 25);

        $this->assertSame(25, StockLevel::query()
            ->where('product_id', $product->id)->where('warehouse_id', $warehouse->id)->value('quantity'));
    }

    public function test_stock_out_fails_when_insufficient_and_does_not_change_quantity(): void
    {
        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();
        StockLevel::query()->create(['product_id' => $product->id, 'warehouse_id' => $warehouse->id, 'quantity' => 5]);

        $response = $this->actingAs($this->depoUser(), 'sanctum')->postJson('/api/stock/out', [
            'warehouseId' => $warehouse->id,
            'productId' => $product->id,
            'quantity' => 10,
            'reason' => 'satis',
        ]);

        $response->assertStatus(422)->assertJsonPath('code', 'VALIDATION');
        $this->assertSame(5, StockLevel::query()
            ->where('product_id', $product->id)->where('warehouse_id', $warehouse->id)->value('quantity'));
    }

    public function test_stock_out_succeeds_and_decreases_quantity(): void
    {
        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();
        StockLevel::query()->create(['product_id' => $product->id, 'warehouse_id' => $warehouse->id, 'quantity' => 20]);

        $response = $this->actingAs($this->depoUser(), 'sanctum')->postJson('/api/stock/out', [
            'warehouseId' => $warehouse->id,
            'productId' => $product->id,
            'quantity' => 8,
            'reason' => 'fire',
        ]);

        $response->assertCreated()->assertJsonPath('newQuantity', 12);
    }

    public function test_transfer_moves_quantity_between_warehouses(): void
    {
        $product = Product::factory()->create();
        $source = Warehouse::factory()->create();
        $target = Warehouse::factory()->create();
        StockLevel::query()->create(['product_id' => $product->id, 'warehouse_id' => $source->id, 'quantity' => 15]);

        $response = $this->actingAs($this->depoUser(), 'sanctum')->postJson('/api/stock/transfer', [
            'sourceWarehouseId' => $source->id,
            'targetWarehouseId' => $target->id,
            'productId' => $product->id,
            'quantity' => 6,
        ]);

        $response->assertCreated()->assertJsonPath('type', 'transfer');
        $this->assertSame(9, StockLevel::query()->where('product_id', $product->id)->where('warehouse_id', $source->id)->value('quantity'));
        $this->assertSame(6, StockLevel::query()->where('product_id', $product->id)->where('warehouse_id', $target->id)->value('quantity'));
    }

    public function test_transfer_of_a_passive_product_is_blocked(): void
    {
        $product = Product::factory()->passive()->create();
        $source = Warehouse::factory()->create();
        $target = Warehouse::factory()->create();
        StockLevel::query()->create(['product_id' => $product->id, 'warehouse_id' => $source->id, 'quantity' => 15]);

        $response = $this->actingAs($this->depoUser(), 'sanctum')->postJson('/api/stock/transfer', [
            'sourceWarehouseId' => $source->id,
            'targetWarehouseId' => $target->id,
            'productId' => $product->id,
            'quantity' => 6,
        ]);

        $response->assertStatus(422)->assertJsonPath('code', 'VALIDATION');
    }

    public function test_repeating_the_same_idempotency_key_does_not_double_post(): void
    {
        $product = Product::factory()->create();
        $warehouse = Warehouse::factory()->create();
        $user = $this->depoUser();
        $key = 'idem-key-123';

        $first = $this->actingAs($user, 'sanctum')->postJson('/api/stock/in', [
            'warehouseId' => $warehouse->id,
            'productId' => $product->id,
            'quantity' => 10,
            'idempotencyKey' => $key,
        ]);
        $second = $this->actingAs($user, 'sanctum')->postJson('/api/stock/in', [
            'warehouseId' => $warehouse->id,
            'productId' => $product->id,
            'quantity' => 10,
            'idempotencyKey' => $key,
        ]);

        $first->assertCreated();
        $second->assertCreated();
        $this->assertSame($first->json('id'), $second->json('id'));
        $this->assertSame(10, StockLevel::query()
            ->where('product_id', $product->id)->where('warehouse_id', $warehouse->id)->value('quantity'));
        $this->assertSame(1, \App\Models\StockMovement::query()->where('product_id', $product->id)->count());
    }

    public function test_stock_in_rejects_an_unknown_warehouse(): void
    {
        $product = Product::factory()->create();

        $response = $this->actingAs($this->depoUser(), 'sanctum')->postJson('/api/stock/in', [
            'warehouseId' => 'wh-does-not-exist',
            'productId' => $product->id,
            'quantity' => 5,
        ]);

        $response->assertStatus(404)->assertJsonPath('code', 'NOT_FOUND');
    }
}
