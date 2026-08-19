<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'prd-'.fake()->unique()->numberBetween(1, 999999),
            'name' => fake()->unique()->words(3, true),
            'sku' => 'SKU-'.fake()->unique()->numberBetween(100000, 999999),
            'barcode' => fake()->unique()->ean13(),
            'category_id' => Category::factory(),
            'brand' => fake()->company(),
            'unit' => 'adet',
            'purchase_price' => fake()->randomFloat(2, 10, 500),
            'sale_price' => fake()->randomFloat(2, 20, 800),
            'min_stock' => 10,
            'max_stock' => 200,
            'status' => 'aktif',
            'supplier_id' => Supplier::factory(),
            'image_url' => null,
        ];
    }

    public function passive(): static
    {
        return $this->state(fn (array $attributes) => ['status' => 'pasif']);
    }
}
