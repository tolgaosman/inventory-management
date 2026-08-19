<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/products')->assertStatus(401);
    }

    public function test_depo_role_cannot_manage_users(): void
    {
        $user = User::factory()->role('depo')->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/users')
            ->assertStatus(403)
            ->assertJsonPath('code', 'FORBIDDEN');
    }

    public function test_depo_role_cannot_manage_products(): void
    {
        $user = User::factory()->role('depo')->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/products', [])
            ->assertStatus(403);
    }

    public function test_satinalma_role_cannot_move_stock(): void
    {
        $user = User::factory()->role('satinalma')->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/stock/in', [])
            ->assertStatus(403);
    }

    public function test_admin_role_can_reach_every_permission_gated_route(): void
    {
        $user = User::factory()->role('admin')->create();

        // admin has every permission — hitting a view-only endpoint should
        // pass the perm gate (200), not be rejected as FORBIDDEN.
        $this->actingAs($user, 'sanctum')->getJson('/api/users')->assertOk();
        $this->actingAs($user, 'sanctum')->getJson('/api/suppliers')->assertOk();
        $this->actingAs($user, 'sanctum')->getJson('/api/warehouses')->assertOk();
    }

    public function test_depo_yonetici_can_manage_products_but_not_purchasing(): void
    {
        $user = User::factory()->role('depo_yonetici')->create();

        $this->actingAs($user, 'sanctum')->getJson('/api/products')->assertOk();
        $this->actingAs($user, 'sanctum')->getJson('/api/purchase-orders')->assertStatus(403);
    }

    public function test_satinalma_yonetici_can_manage_purchasing_but_not_products(): void
    {
        $user = User::factory()->role('satinalma_yonetici')->create();

        $this->actingAs($user, 'sanctum')->getJson('/api/purchase-orders')->assertOk();
        $this->actingAs($user, 'sanctum')->postJson('/api/products', [])->assertStatus(403);
    }

    public function test_settings_is_reachable_by_every_authenticated_role_regardless_of_permissions(): void
    {
        foreach (['depo', 'satinalma', 'depo_yonetici', 'satinalma_yonetici', 'admin'] as $role) {
            $user = User::factory()->role($role)->create();

            $this->actingAs($user, 'sanctum')->getJson('/api/settings')->assertOk();
        }
    }
}
