<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductTest extends TestCase
{
    use RefreshDatabase;

    private function manager(): User
    {
        return User::factory()->role('admin')->create();
    }

    public function test_creating_a_product_requires_an_existing_category_and_supplier(): void
    {
        $response = $this->actingAs($this->manager(), 'sanctum')->postJson('/api/products', [
            'name' => 'Test Ürün',
            'sku' => 'SKU-1',
            'barcode' => '1234567890123',
            'categoryId' => 'cat-does-not-exist',
            'brand' => 'Marka',
            'unit' => 'adet',
            'purchasePrice' => 10,
            'minStock' => 5,
            'maxStock' => 50,
            'supplierId' => 'sup-does-not-exist',
        ]);

        $response->assertStatus(422)->assertJsonPath('code', 'VALIDATION');
    }

    public function test_creating_a_product_succeeds_with_valid_references(): void
    {
        $category = Category::factory()->create();
        $supplier = Supplier::factory()->create();

        $response = $this->actingAs($this->manager(), 'sanctum')->postJson('/api/products', [
            'name' => 'Test Ürün',
            'sku' => 'SKU-1',
            'barcode' => '1234567890123',
            'categoryId' => $category->id,
            'brand' => 'Marka',
            'unit' => 'adet',
            'purchasePrice' => 10,
            'minStock' => 5,
            'maxStock' => 50,
            'supplierId' => $supplier->id,
        ]);

        $response->assertCreated()
            ->assertJsonPath('sku', 'SKU-1')
            ->assertJsonPath('status', 'aktif')
            ->assertJsonPath('totalStock', 0)
            ->assertJsonPath('critical', true); // 0 units < minStock(5)

        $this->assertDatabaseHas('products', ['sku' => 'SKU-1']);
    }

    public function test_duplicate_sku_is_rejected(): void
    {
        $existing = Product::factory()->create(['sku' => 'SKU-DUP']);
        $category = Category::factory()->create();
        $supplier = Supplier::factory()->create();

        $response = $this->actingAs($this->manager(), 'sanctum')->postJson('/api/products', [
            'name' => 'Başka Ürün',
            'sku' => 'SKU-DUP',
            'barcode' => '9999999999999',
            'categoryId' => $category->id,
            'brand' => 'Marka',
            'unit' => 'adet',
            'purchasePrice' => 10,
            'minStock' => 5,
            'maxStock' => 50,
            'supplierId' => $supplier->id,
        ]);

        $response->assertStatus(409)->assertJsonPath('code', 'CONFLICT');
        $this->assertSame(1, Product::query()->where('sku', 'SKU-DUP')->count());
    }

    public function test_product_total_stock_and_critical_flag_reflect_stock_levels(): void
    {
        $product = Product::factory()->create(['min_stock' => 10]);
        $warehouseA = Warehouse::factory()->create();
        $warehouseB = Warehouse::factory()->create();
        StockLevel::query()->create(['product_id' => $product->id, 'warehouse_id' => $warehouseA->id, 'quantity' => 3]);
        StockLevel::query()->create(['product_id' => $product->id, 'warehouse_id' => $warehouseB->id, 'quantity' => 4]);

        $response = $this->actingAs($this->manager(), 'sanctum')->getJson("/api/products/{$product->id}");

        $response->assertOk()
            ->assertJsonPath('totalStock', 7)
            ->assertJsonPath('critical', true); // 7 < 10
    }

    public function test_deleting_a_product_removes_it(): void
    {
        $product = Product::factory()->create();

        $this->actingAs($this->manager(), 'sanctum')
            ->deleteJson("/api/products/{$product->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('products', ['id' => $product->id]);
    }
}
