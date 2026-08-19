<?php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'cat-'.fake()->unique()->numberBetween(1, 999999),
            'name' => fake()->unique()->word(),
            'parent_id' => null,
        ];
    }
}
