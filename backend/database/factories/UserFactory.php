<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        $name = fake()->name();

        return [
            'id' => 'usr-'.fake()->unique()->numberBetween(1, 999999),
            'name' => $name,
            'email' => fake()->unique()->safeEmail(),
            'phone' => fake()->phoneNumber(),
            'role' => 'yonetici',
            'initials' => mb_strtoupper(mb_substr($name, 0, 2)),
            'password' => static::$password ??= Hash::make('password'),
        ];
    }

    public function role(string $role): static
    {
        return $this->state(fn (array $attributes) => ['role' => $role]);
    }
}
