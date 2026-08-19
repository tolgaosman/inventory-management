<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_with_valid_credentials_returns_token_and_permissions(): void
    {
        $user = User::factory()->role('admin')->create([
            'password' => Hash::make('demo1234'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'demo1234',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role', 'initials'], 'permissions'])
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonPath('permissions', $user->permissions());
    }

    public function test_login_with_wrong_password_is_rejected(): void
    {
        $user = User::factory()->create(['password' => Hash::make('demo1234')]);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
    }

    public function test_login_is_case_insensitive_on_email(): void
    {
        $user = User::factory()->create([
            'email' => 'Tolga@Sirket.com',
            'password' => Hash::make('demo1234'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'tolga@sirket.com',
            'password' => 'demo1234',
        ]);

        $response->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_login_is_throttled_after_six_attempts(): void
    {
        $user = User::factory()->create(['password' => Hash::make('demo1234')]);

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong']);
        }

        $response = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong']);

        $response->assertStatus(429)->assertJsonPath('code', 'VALIDATION');
    }

    public function test_me_requires_a_valid_token(): void
    {
        $this->getJson('/api/auth/me')->assertStatus(401);
    }

    public function test_me_returns_the_authenticated_user(): void
    {
        $user = User::factory()->role('depo')->create();

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/auth/me');

        $response->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('permissions', $user->permissions());
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $user = User::factory()->create(['password' => Hash::make('demo1234')]);
        $token = $user->createToken('api')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/auth/logout')
            ->assertOk();

        // Sanctum's RequestGuard memoizes the resolved user on the guard
        // instance, and the test client reuses one Application across calls
        // in a test — without this, the second call would still see the
        // pre-logout user even though the token row is gone.
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/auth/me')
            ->assertStatus(401);
    }

    public function test_forgot_password_does_not_reveal_whether_the_email_exists(): void
    {
        $known = User::factory()->create();

        $forKnown = $this->postJson('/api/auth/forgot-password', ['email' => $known->email]);
        $forUnknown = $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@example.com']);

        $forKnown->assertOk();
        $forUnknown->assertOk();
        $this->assertSame($forKnown->json('message'), $forUnknown->json('message'));
        $this->assertArrayNotHasKey('debugToken', $forUnknown->json());
        $this->assertArrayHasKey('debugToken', $forKnown->json());
    }

    public function test_reset_password_with_a_valid_token_updates_the_password_and_revokes_old_tokens(): void
    {
        $user = User::factory()->create(['password' => Hash::make('old-password')]);
        $oldToken = $user->createToken('api')->plainTextToken;
        $token = Password::broker('users')->createToken($user);

        $response = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ]);

        $response->assertOk();
        $this->assertTrue(Hash::check('new-password-123', $user->fresh()->password));

        $this->withHeader('Authorization', "Bearer {$oldToken}")
            ->getJson('/api/auth/me')
            ->assertStatus(401);
    }

    public function test_reset_password_with_an_invalid_token_is_rejected(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/auth/reset-password', [
            'email' => $user->email,
            'token' => 'not-a-real-token',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ]);

        $response->assertStatus(422)->assertJsonPath('code', 'VALIDATION');
    }
}
