<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$totalValue = (float) DB::table('purchase_order_items')
    ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
    ->whereNotIn('purchase_orders.status', ['cancelled', 'draft', 'pending_approval'])
    ->sum(DB::raw('purchase_order_items.quantity * purchase_order_items.unit_price'));

echo "Total Value: " . $totalValue . "\n";
