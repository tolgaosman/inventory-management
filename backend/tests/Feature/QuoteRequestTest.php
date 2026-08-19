<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuoteRequestTest extends TestCase
{
    use RefreshDatabase;

    private function buyer(): User
    {
        return User::factory()->role('satinalma')->create();
    }

    private function createDraftOrder(User $user, Supplier $supplier): array
    {
        $product = Product::factory()->create(['supplier_id' => $supplier->id]);
        $warehouse = Warehouse::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/purchase-orders', [
            'supplierId' => $supplier->id,
            'warehouseId' => $warehouse->id,
            'expectedAt' => now()->addDays(7)->toIso8601String(),
            'items' => [
                ['productId' => $product->id, 'quantity' => 5, 'unitPrice' => 100],
            ],
        ]);
        $response->assertCreated();

        return $response->json();
    }

    private function quotePayload(array $orderIds): array
    {
        return [
            'purchaseOrderIds' => $orderIds,
            'validUntil' => now()->addDays(14)->toIso8601String(),
            'deliveryDate' => now()->addDays(21)->toIso8601String(),
            'deliveryAddress' => 'Lefkoşa, KKTC',
            'paymentTerms' => '30 gün vade',
            'requestedCurrency' => 'try',
            'contactName' => 'Test Kişi',
            'contactEmail' => 'test@sirket.com',
            'contactPhone' => '05551234567',
        ];
    }

    public function test_creating_a_quote_from_two_orders_of_the_same_supplier_succeeds(): void
    {
        $user = $this->buyer();
        $supplier = Supplier::factory()->create();
        $orderA = $this->createDraftOrder($user, $supplier);
        $orderB = $this->createDraftOrder($user, $supplier);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([
            $orderA['id'], $orderB['id'],
        ]));

        $response->assertCreated()->assertJsonPath('supplierId', $supplier->id);
        $this->assertStringStartsWith('NET-TKL-', $response->json('code'));
    }

    public function test_creating_a_quote_from_orders_of_different_suppliers_is_rejected(): void
    {
        $user = $this->buyer();
        $orderA = $this->createDraftOrder($user, Supplier::factory()->create());
        $orderB = $this->createDraftOrder($user, Supplier::factory()->create());

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([
            $orderA['id'], $orderB['id'],
        ]));

        $response->assertStatus(422)->assertJsonPath('code', 'VALIDATION');
    }

    public function test_creating_a_quote_from_an_already_ordered_order_is_rejected(): void
    {
        $user = $this->buyer();
        $supplier = Supplier::factory()->create();
        $order = $this->createDraftOrder($user, $supplier);
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$order['id']}/order")->assertOk();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([$order['id']]));

        $response->assertStatus(422)->assertJsonPath('code', 'VALIDATION');
    }

    public function test_creating_a_quote_requires_at_least_one_order(): void
    {
        $user = $this->buyer();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([]));

        $response->assertStatus(422);
    }
}
