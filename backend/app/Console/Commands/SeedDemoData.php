<?php

namespace App\Console\Commands;

use App\Support\JsonStore;
use Database\Seeders\DemoDataSeeder;
use Illuminate\Console\Command;

class SeedDemoData extends Command
{
    protected $signature = 'data:seed {--fresh : Delete existing JSON data files before reseeding}';

    protected $description = 'Regenerate the JSON-file demo dataset (warehouses, products, movements, purchase orders, ...)';

    public function handle(JsonStore $store): int
    {
        if ($this->option('fresh')) {
            $dir = $store->dataDir();
            foreach (glob($dir.'/*.json') ?: [] as $file) {
                unlink($file);
            }
            $this->info('Existing data files removed.');
        }

        app(DemoDataSeeder::class)->run();

        $counts = [
            'warehouses', 'categories', 'suppliers', 'users', 'products',
            'stock_levels', 'stock_movements', 'purchase_orders',
        ];
        foreach ($counts as $collection) {
            $this->line(sprintf('%-18s %d', $collection, count($store->read($collection))));
        }

        $this->info('Demo data seeded into '.$store->dataDir());

        return self::SUCCESS;
    }
}
