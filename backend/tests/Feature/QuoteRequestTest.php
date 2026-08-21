<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuoteRequestTest extends TestCase
{
    use RefreshDatabase;

    private function buyer(): User
    {
        return User::factory()->role('satinalma_yonetici')->create();
    }

    private function staff(): User
    {
        return User::factory()->role('satinalma')->create();
    }

    private function quotePayload(array $overrides = []): array
    {
        return array_merge([
            'validUntil' => now()->addDays(14)->toIso8601String(),
            'deliveryDate' => now()->addDays(21)->toIso8601String(),
            'deliveryAddress' => 'Lefkoşa, KKTC',
            'paymentTerms' => '30 gün vade',
            'requestedCurrency' => 'try',
            'contactName' => 'Test Kişi',
            'contactEmail' => 'test@sirket.com',
            'contactPhone' => '05551234567',
        ], $overrides);
    }

    public function test_creating_a_quote_for_an_existing_supplier_with_a_catalog_item_succeeds(): void
    {
        $user = $this->buyer();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([
            'supplierId' => $supplier->id,
            'items' => [['productId' => $product->id, 'quantity' => 5]],
        ]));

        $response->assertCreated()->assertJsonPath('supplierId', $supplier->id);
        $this->assertStringStartsWith('NET-TKL-', $response->json('code'));
    }

    public function test_creating_a_quote_for_a_brand_new_adhoc_supplier_with_an_adhoc_item_succeeds(): void
    {
        $user = $this->buyer();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([
            'adhocSupplierName' => 'Henüz Kayıtlı Olmayan Tedarikçi',
            'adhocSupplierEmail' => 'yeni@tedarikci.com',
            'items' => [['productName' => 'Özel Kablo Seti', 'unit' => 'adet', 'quantity' => 10]],
        ]));

        $response->assertCreated()
            ->assertJsonPath('supplierId', null)
            ->assertJsonPath('adhocSupplierName', 'Henüz Kayıtlı Olmayan Tedarikçi')
            ->assertJsonPath('adhocSupplierEmail', 'yeni@tedarikci.com');
    }

    public function test_creating_a_quote_without_a_supplier_or_adhoc_name_is_rejected(): void
    {
        $user = $this->buyer();
        $product = Product::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([
            'items' => [['productId' => $product->id, 'quantity' => 5]],
        ]));

        $response->assertStatus(422)->assertJsonPath('code', 'VALIDATION');
    }

    public function test_creating_a_quote_for_an_adhoc_supplier_without_an_email_is_rejected(): void
    {
        $user = $this->buyer();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([
            'adhocSupplierName' => 'Henüz Kayıtlı Olmayan Tedarikçi',
            'items' => [['productName' => 'Özel Kablo Seti', 'unit' => 'adet', 'quantity' => 10]],
        ]));

        $response->assertStatus(422)->assertJsonPath('code', 'VALIDATION');
    }

    public function test_creating_a_quote_requires_at_least_one_item(): void
    {
        $user = $this->buyer();
        $supplier = Supplier::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([
            'supplierId' => $supplier->id,
            'items' => [],
        ]));

        $response->assertStatus(422);
    }

    public function test_creating_a_quote_item_without_a_product_or_adhoc_name_and_unit_is_rejected(): void
    {
        $user = $this->buyer();
        $supplier = Supplier::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([
            'supplierId' => $supplier->id,
            'items' => [['quantity' => 5]],
        ]));

        $response->assertStatus(422)->assertJsonPath('code', 'VALIDATION');
    }

    public function test_quote_created_by_an_approver_is_approved_immediately(): void
    {
        $approver = $this->buyer();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->create();

        $response = $this->actingAs($approver, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([
            'supplierId' => $supplier->id,
            'items' => [['productId' => $product->id, 'quantity' => 5]],
        ]));

        $response->assertCreated()->assertJsonPath('status', 'approved');
    }

    public function test_quote_created_by_staff_without_approve_starts_pending_approval(): void
    {
        $staff = $this->staff();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->create();

        $response = $this->actingAs($staff, 'sanctum')->postJson('/api/quote-requests', $this->quotePayload([
            'supplierId' => $supplier->id,
            'items' => [['productId' => $product->id, 'quantity' => 5]],
        ]));

        $response->assertCreated()->assertJsonPath('status', 'pending_approval');
    }

    private function createStaffQuote(User $staff): array
    {
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->create();

        return $this->actingAs($staff, 'sanctum')
            ->postJson('/api/quote-requests', $this->quotePayload([
                'supplierId' => $supplier->id,
                'items' => [['productId' => $product->id, 'quantity' => 5]],
            ]))
            ->json();
    }

    public function test_approver_can_approve_a_staff_created_quote(): void
    {
        $staff = $this->staff();
        $approver = $this->buyer();
        $quote = $this->createStaffQuote($staff);

        $this->actingAs($approver, 'sanctum')->postJson("/api/quote-requests/{$quote['id']}/approve")
            ->assertOk()->assertJsonPath('status', 'approved');
    }

    public function test_approver_rejecting_a_staff_created_quote_deletes_it(): void
    {
        $staff = $this->staff();
        $approver = $this->buyer();
        $quote = $this->createStaffQuote($staff);

        $this->actingAs($approver, 'sanctum')->postJson("/api/quote-requests/{$quote['id']}/reject")
            ->assertOk()->assertJsonPath('deleted', true);

        $this->actingAs($approver, 'sanctum')->getJson("/api/quote-requests/{$quote['id']}")
            ->assertStatus(404);
    }

    public function test_staff_cannot_approve_their_own_quote(): void
    {
        $staff = $this->staff();
        $quote = $this->createStaffQuote($staff);

        $this->actingAs($staff, 'sanctum')->postJson("/api/quote-requests/{$quote['id']}/approve")
            ->assertStatus(403);
    }

    public function test_approving_a_non_pending_quote_is_rejected(): void
    {
        $approver = $this->buyer();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->create();

        $quote = $this->actingAs($approver, 'sanctum')
            ->postJson('/api/quote-requests', $this->quotePayload([
                'supplierId' => $supplier->id,
                'items' => [['productId' => $product->id, 'quantity' => 5]],
            ]))
            ->json();

        // Already approved on creation (approver-authored).
        $this->actingAs($approver, 'sanctum')->postJson("/api/quote-requests/{$quote['id']}/approve")
            ->assertStatus(409)->assertJsonPath('code', 'CONFLICT');
    }
}
