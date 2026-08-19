<?php

namespace Database\Factories;

use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Warehouse>
 */
class WarehouseFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'wh-'.fake()->unique()->numberBetween(1, 999999),
            'name' => fake()->city().' Depo',
            'city' => fake()->city(),
            'address' => fake()->address(),
            'capacity' => fake()->numberBetween(500, 5000),
        ];
    }
}
