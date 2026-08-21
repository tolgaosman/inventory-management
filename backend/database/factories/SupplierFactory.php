<?php

namespace Database\Factories;

use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Supplier>
 */
class SupplierFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'sup-'.fake()->unique()->numberBetween(1, 999999),
            'name' => fake()->unique()->company(),
            'contact_name' => fake()->name(),
            'emails' => [fake()->unique()->companyEmail(), fake()->unique()->companyEmail(), fake()->unique()->companyEmail()],
            'phone' => fake()->phoneNumber(),
            'city' => fake()->city(),
        ];
    }
}
