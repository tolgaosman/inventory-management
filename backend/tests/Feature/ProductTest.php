<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Role;
use App\Models\RolePermission;
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

    /** A delivered purchase line for $product, priced at $unitPrice. */
    private function purchaseLine(Product $product, float $unitPrice, int $quantity = 5): PurchaseOrderItem
    {
        static $seq = 0;
        $seq++;

        $po = PurchaseOrder::query()->create([
            'id' => "po-test-{$seq}",
            'code' => "NET-PO-TEST{$seq}",
            'supplier_id' => Supplier::factory()->create()->id,
            'warehouse_id' => Warehouse::factory()->create()->id,
            'status' => 'received',
            'created_at' => now()->addMinutes($seq), // later calls = more recent orders
        ]);

        return PurchaseOrderItem::query()->create([
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'received_quantity' => $quantity,
        ]);
    }

    /** The product form posts every field, so updates have to send the full set. */
    private function updatePayload(Product $product, array $overrides = []): array
    {
        return array_merge([
            'name' => $product->name,
            'sku' => $product->sku,
            'barcode' => $product->barcode,
            'categoryId' => $product->category_id,
            'brand' => $product->brand,
            'unit' => $product->unit,
            'purchasePrice' => $product->purchase_price,
            'minStock' => $product->min_stock,
            'maxStock' => $product->max_stock,
            'supplierId' => $product->supplier_id,
        ], $overrides);
    }

    public function test_past_purchase_lines_keep_their_price_when_the_product_price_changes(): void
    {
        $product = Product::factory()->create(['purchase_price' => 10]);
        $old = $this->purchaseLine($product, 10);
        $older = $this->purchaseLine($product, 8);

        $this->actingAs($this->manager(), 'sanctum')
            ->putJson("/api/products/{$product->id}", $this->updatePayload($product, ['purchasePrice' => 25]))
            ->assertOk()
            ->assertJsonPath('purchasePrice', 25);

        $this->assertSame('10.00', PurchaseOrderItem::query()->find($old->id)->unit_price);
        $this->assertSame('8.00', PurchaseOrderItem::query()->find($older->id)->unit_price);
    }

    public function test_only_the_selected_purchase_lines_adopt_the_new_price(): void
    {
        $product = Product::factory()->create(['purchase_price' => 10]);
        $picked = $this->purchaseLine($product, 10);
        $untouched = $this->purchaseLine($product, 8);

        $this->actingAs($this->manager(), 'sanctum')
            ->putJson("/api/products/{$product->id}", $this->updatePayload($product, [
                'purchasePrice' => 25,
                'applyPriceToItemIds' => [$picked->id],
            ]))
            ->assertOk();

        $this->assertSame('25.00', PurchaseOrderItem::query()->find($picked->id)->unit_price);
        $this->assertSame('8.00', PurchaseOrderItem::query()->find($untouched->id)->unit_price);
    }

    public function test_applying_a_price_cannot_reach_another_products_purchase_line(): void
    {
        $product = Product::factory()->create(['purchase_price' => 10]);
        $other = Product::factory()->create(['purchase_price' => 99]);
        $foreign = $this->purchaseLine($other, 99);

        $this->actingAs($this->manager(), 'sanctum')
            ->putJson("/api/products/{$product->id}", $this->updatePayload($product, [
                'purchasePrice' => 25,
                'applyPriceToItemIds' => [$foreign->id],
            ]))
            ->assertOk();

        $this->assertSame('99.00', PurchaseOrderItem::query()->find($foreign->id)->unit_price);
    }

    public function test_purchase_history_lists_lines_newest_first_with_their_own_prices(): void
    {
        $product = Product::factory()->create(['purchase_price' => 10]);
        $this->purchaseLine($product, 8);   // older (created_at further back)
        $newest = $this->purchaseLine($product, 12);

        $response = $this->actingAs($this->manager(), 'sanctum')
            ->getJson("/api/products/{$product->id}/purchases");

        $response->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.itemId', $newest->id)
            ->assertJsonPath('0.unitPrice', 12)
            ->assertJsonPath('1.unitPrice', 8);
    }

    public function test_purchase_history_hides_prices_without_financial_view(): void
    {
        $product = Product::factory()->create(['purchase_price' => 10]);
        $this->purchaseLine($product, 12);

        // Every seeded role happens to carry financial.view, so build one that doesn't.
        Role::query()->create(['id' => 'gozlemci', 'name' => 'Gözlemci', 'is_system' => false]);
        RolePermission::query()->create(['role_id' => 'gozlemci', 'permission' => 'products.view']);
        $observer = User::factory()->role('gozlemci')->create();

        $this->actingAs($observer, 'sanctum')
            ->getJson("/api/products/{$product->id}/purchases")
            ->assertOk()
            ->assertJsonPath('0.unitPrice', null)
            ->assertJsonPath('0.lineTotal', null);
    }
}
