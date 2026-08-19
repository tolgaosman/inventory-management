<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

class SeedDemoData extends Command
{
    protected $signature = 'data:seed {--fresh : Drop and recreate all tables before reseeding}';

    protected $description = 'Regenerate the demo dataset (warehouses, products, movements, purchase orders, ...)';

    public function handle(): int
    {
        if ($this->option('fresh')) {
            Artisan::call('migrate:fresh', [], $this->output);
        }

        Artisan::call('db:seed', ['--class' => \Database\Seeders\DemoDataSeeder::class, '--force' => true], $this->output);

        $counts = [
            'warehouses' => Warehouse::count(),
            'categories' => Category::count(),
            'suppliers' => Supplier::count(),
            'users' => User::count(),
            'products' => Product::count(),
            'stock_levels' => StockLevel::count(),
            'stock_movements' => StockMovement::count(),
            'purchase_orders' => PurchaseOrder::count(),
        ];
        foreach ($counts as $name => $count) {
            $this->line(sprintf('%-18s %d', $name, $count));
        }

        $this->info('Demo data seeded.');

        return self::SUCCESS;
    }
}
