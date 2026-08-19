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

    /** An approver — used where the test needs a mechanic (e.g. marking an order
     *  "ordered") that isn't itself what's being tested. Approval-routing behavior
     *  for quotes is covered separately below using staff().
     */
    private function buyer(): User
    {
        return User::factory()->role('satinalma_yonetici')->create();
    }

    private function staff(): User
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

    public function test_quote_created_by_an_approver_is_approved_immediately(): void
    {
        $approver = $this->buyer();
        $supplier = Supplier::factory()->create();
        $order = $this->createDraftOrder($approver, $supplier);

        $response = $this->actingAs($approver, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([$order['id']]));

        $response->assertCreated()->assertJsonPath('status', 'approved');
    }

    public function test_quote_created_by_staff_without_approve_starts_pending_approval(): void
    {
        $staff = $this->staff();
        $supplier = Supplier::factory()->create();
        $order = $this->createDraftOrder($staff, $supplier);

        $response = $this->actingAs($staff, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([$order['id']]));

        $response->assertCreated()->assertJsonPath('status', 'pending_approval');
    }

    public function test_approver_can_approve_a_staff_created_quote(): void
    {
        $staff = $this->staff();
        $approver = $this->buyer();
        $supplier = Supplier::factory()->create();
        $order = $this->createDraftOrder($staff, $supplier);
        $quote = $this->actingAs($staff, 'sanctum')
            ->postJson('/api/quote-requests', $this->quotePayload([$order['id']]))
            ->json();

        $this->actingAs($approver, 'sanctum')->postJson("/api/quote-requests/{$quote['id']}/approve")
            ->assertOk()->assertJsonPath('status', 'approved');
    }

    public function test_approver_can_reject_a_staff_created_quote(): void
    {
        $staff = $this->staff();
        $approver = $this->buyer();
        $supplier = Supplier::factory()->create();
        $order = $this->createDraftOrder($staff, $supplier);
        $quote = $this->actingAs($staff, 'sanctum')
            ->postJson('/api/quote-requests', $this->quotePayload([$order['id']]))
            ->json();

        $this->actingAs($approver, 'sanctum')->postJson("/api/quote-requests/{$quote['id']}/reject")
            ->assertOk()->assertJsonPath('status', 'rejected');
    }

    public function test_staff_cannot_approve_their_own_quote(): void
    {
        $staff = $this->staff();
        $supplier = Supplier::factory()->create();
        $order = $this->createDraftOrder($staff, $supplier);
        $quote = $this->actingAs($staff, 'sanctum')
            ->postJson('/api/quote-requests', $this->quotePayload([$order['id']]))
            ->json();

        $this->actingAs($staff, 'sanctum')->postJson("/api/quote-requests/{$quote['id']}/approve")
            ->assertStatus(403);
    }

    public function test_approving_a_non_pending_quote_is_rejected(): void
    {
        $approver = $this->buyer();
        $supplier = Supplier::factory()->create();
        $order = $this->createDraftOrder($approver, $supplier);
        $quote = $this->actingAs($approver, 'sanctum')
            ->postJson('/api/quote-requests', $this->quotePayload([$order['id']]))
            ->json();

        // Already approved on creation (approver-authored).
        $this->actingAs($approver, 'sanctum')->postJson("/api/quote-requests/{$quote['id']}/approve")
            ->assertStatus(409)->assertJsonPath('code', 'CONFLICT');
    }
}
