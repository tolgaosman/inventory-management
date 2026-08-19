<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\StockLevel;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PurchaseOrderTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    /**
     * An approver (purchase.approve) — most of the lifecycle mechanics below
     * (draft → ordered → received, edit, cancel, delete) are orthogonal to who's
     * doing it, so they use an approver to skip the approval-routing behavior
     * that's covered separately in the approval-routing tests below.
     */
    private function buyer(): User
    {
        return User::factory()->role('satinalma_yonetici')->create();
    }

    private function staff(): User
    {
        return User::factory()->role('satinalma')->create();
    }

    /** receive() requires an invoice on file first — see PurchaseOrderService::receive(). */
    private function attachInvoice(User $user, string $poId): void
    {
        $this->actingAs($user, 'sanctum')
            ->post("/api/purchase-orders/{$poId}/invoice", [
                'invoice' => UploadedFile::fake()->create('fatura.pdf', 100, 'application/pdf'),
            ])
            ->assertOk();
    }

    private function createDraftOrder(User $user, ?Product $product = null, ?Warehouse $warehouse = null, int $quantity = 10): array
    {
        $product ??= Product::factory()->create();
        $warehouse ??= Warehouse::factory()->create();
        $supplier = Supplier::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/purchase-orders', [
            'supplierId' => $supplier->id,
            'warehouseId' => $warehouse->id,
            'expectedAt' => now()->addDays(7)->toIso8601String(),
            'items' => [
                ['productId' => $product->id, 'quantity' => $quantity, 'unitPrice' => 15.5],
            ],
        ]);
        $response->assertCreated();

        return [$response->json(), $product, $warehouse];
    }

    public function test_creating_an_order_requires_at_least_one_item(): void
    {
        $supplier = Supplier::factory()->create();
        $warehouse = Warehouse::factory()->create();

        $response = $this->actingAs($this->buyer(), 'sanctum')->postJson('/api/purchase-orders', [
            'supplierId' => $supplier->id,
            'warehouseId' => $warehouse->id,
            'expectedAt' => now()->addDays(7)->toIso8601String(),
            'items' => [],
        ]);

        $response->assertStatus(422)->assertJsonPath('code', 'VALIDATION');
    }

    public function test_creating_an_order_starts_as_draft(): void
    {
        [$po] = $this->createDraftOrder($this->buyer());

        $this->assertSame('draft', $po['status']);
        $this->assertStringStartsWith('NET-PO-', $po['code']);
    }

    public function test_full_approval_workflow_draft_to_pending_to_ordered(): void
    {
        $user = $this->buyer();
        [$po] = $this->createDraftOrder($user);
        $id = $po['id'];

        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/request-approval")
            ->assertOk()->assertJsonPath('status', 'pending_approval');

        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/approve")
            ->assertOk()->assertJsonPath('status', 'ordered');
    }

    public function test_approve_is_rejected_when_order_is_not_pending_approval(): void
    {
        $user = $this->buyer();
        [$po] = $this->createDraftOrder($user);

        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$po['id']}/approve")
            ->assertStatus(409)->assertJsonPath('code', 'CONFLICT');
    }

    public function test_reject_sends_a_pending_order_back_to_draft(): void
    {
        $user = $this->buyer();
        [$po] = $this->createDraftOrder($user);
        $id = $po['id'];

        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/request-approval")->assertOk();
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/reject")
            ->assertOk()->assertJsonPath('status', 'draft');
    }

    public function test_receiving_a_full_order_creates_stock_and_marks_it_received(): void
    {
        $user = $this->buyer();
        [$po, $product, $warehouse] = $this->createDraftOrder($user, quantity: 10);
        $id = $po['id'];

        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/order")->assertOk();
        $this->attachInvoice($user, $id);

        $response = $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/receive", [
            'receivedQuantities' => [$product->id => 10],
        ]);

        $response->assertOk()->assertJsonPath('status', 'received');
        $this->assertSame(10, StockLevel::query()
            ->where('product_id', $product->id)->where('warehouse_id', $warehouse->id)->value('quantity'));
        $this->assertSame(1, \App\Models\StockMovement::query()->where('purchase_order_id', $id)->count());
    }

    public function test_partially_receiving_an_order_leaves_it_partially_received(): void
    {
        $user = $this->buyer();
        [$po, $product] = $this->createDraftOrder($user, quantity: 10);
        $id = $po['id'];
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/order")->assertOk();
        $this->attachInvoice($user, $id);

        $response = $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/receive", [
            'receivedQuantities' => [$product->id => 4],
        ]);

        $response->assertOk()->assertJsonPath('status', 'partially_received');
    }

    public function test_over_receiving_is_capped_at_the_ordered_quantity(): void
    {
        $user = $this->buyer();
        [$po, $product, $warehouse] = $this->createDraftOrder($user, quantity: 10);
        $id = $po['id'];
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/order")->assertOk();
        $this->attachInvoice($user, $id);

        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/receive", [
            'receivedQuantities' => [$product->id => 999],
        ])->assertOk()->assertJsonPath('status', 'received');

        $this->assertSame(10, StockLevel::query()
            ->where('product_id', $product->id)->where('warehouse_id', $warehouse->id)->value('quantity'));
    }

    public function test_cancelled_order_cannot_be_received(): void
    {
        $user = $this->buyer();
        [$po, $product] = $this->createDraftOrder($user);
        $id = $po['id'];
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/cancel")->assertOk();

        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/receive", [
            'receivedQuantities' => [$product->id => 5],
        ])->assertStatus(409)->assertJsonPath('code', 'CONFLICT');
    }

    public function test_received_order_cannot_be_cancelled(): void
    {
        $user = $this->buyer();
        [$po, $product] = $this->createDraftOrder($user, quantity: 5);
        $id = $po['id'];
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/order")->assertOk();
        $this->attachInvoice($user, $id);
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/receive", [
            'receivedQuantities' => [$product->id => 5],
        ])->assertOk();

        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/cancel")
            ->assertStatus(409)->assertJsonPath('code', 'CONFLICT');
    }

    public function test_only_draft_orders_can_be_deleted(): void
    {
        $user = $this->buyer();
        [$po] = $this->createDraftOrder($user);
        $id = $po['id'];
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/order")->assertOk();

        $this->actingAs($user, 'sanctum')->deleteJson("/api/purchase-orders/{$id}")
            ->assertStatus(409)->assertJsonPath('code', 'CONFLICT');
    }

    public function test_a_partially_received_order_cannot_be_edited(): void
    {
        $user = $this->buyer();
        [$po, $product, $warehouse] = $this->createDraftOrder($user, quantity: 10);
        $id = $po['id'];
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/order")->assertOk();
        $this->attachInvoice($user, $id);
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$id}/receive", [
            'receivedQuantities' => [$product->id => 3],
        ])->assertOk();

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/purchase-orders/{$id}", [
            'notes' => 'değişti',
        ]);

        $response->assertStatus(409)->assertJsonPath('code', 'CONFLICT');
    }

    public function test_order_created_by_staff_without_approve_starts_pending_approval(): void
    {
        [$po] = $this->createDraftOrder($this->staff());

        $this->assertSame('pending_approval', $po['status']);
    }

    public function test_staff_cannot_mark_a_pending_order_as_ordered_directly(): void
    {
        $staff = $this->staff();
        [$po] = $this->createDraftOrder($staff);

        // Already pending_approval (see test above), so /order is doubly blocked:
        // no purchase.approve, and the transition guard only allows draft -> ordered.
        $this->actingAs($staff, 'sanctum')->postJson("/api/purchase-orders/{$po['id']}/order")
            ->assertStatus(403);
    }

    public function test_approver_can_approve_a_staff_created_order(): void
    {
        $staff = $this->staff();
        $approver = $this->buyer();
        [$po] = $this->createDraftOrder($staff);

        $this->assertSame('pending_approval', $po['status']);

        $this->actingAs($approver, 'sanctum')->postJson("/api/purchase-orders/{$po['id']}/approve")
            ->assertOk()->assertJsonPath('status', 'ordered');
    }

    public function test_staff_cannot_edit_an_ordered_order(): void
    {
        $approver = $this->buyer();
        [$po] = $this->createDraftOrder($approver);
        $id = $po['id'];
        $this->actingAs($approver, 'sanctum')->postJson("/api/purchase-orders/{$id}/order")->assertOk();

        $this->actingAs($this->staff(), 'sanctum')->putJson("/api/purchase-orders/{$id}", ['notes' => 'x'])
            ->assertStatus(403);
    }

    public function test_depo_can_receive_and_invoice_but_not_create_orders(): void
    {
        $approver = $this->buyer();
        [$po, $product] = $this->createDraftOrder($approver, quantity: 5);
        $id = $po['id'];
        $this->actingAs($approver, 'sanctum')->postJson("/api/purchase-orders/{$id}/order")->assertOk();

        $depo = User::factory()->role('depo')->create();
        $this->actingAs($depo, 'sanctum')->postJson('/api/purchase-orders', [])->assertStatus(403);

        $this->attachInvoice($depo, $id);
        $this->actingAs($depo, 'sanctum')->postJson("/api/purchase-orders/{$id}/receive", [
            'receivedQuantities' => [$product->id => 5],
        ])->assertOk()->assertJsonPath('status', 'received');
    }

    public function test_bulk_cancel_reports_per_id_failures(): void
    {
        $user = $this->buyer();
        [$draft] = $this->createDraftOrder($user);
        [$toReceive, $product] = $this->createDraftOrder($user, quantity: 5);
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$toReceive['id']}/order")->assertOk();
        $this->attachInvoice($user, $toReceive['id']);
        $this->actingAs($user, 'sanctum')->postJson("/api/purchase-orders/{$toReceive['id']}/receive", [
            'receivedQuantities' => [$product->id => 5],
        ])->assertOk();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/purchase-orders/bulk-cancel', [
            'ids' => [$draft['id'], $toReceive['id']],
        ]);

        $response->assertOk()
            ->assertJsonPath('successCount', 1)
            ->assertJsonPath('failed.0.id', $toReceive['id']);
    }
}
