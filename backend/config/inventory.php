<?php

// Central home for thresholds that were duplicated across the frontend mock
// modules (e.g. the 1.5x "low stock" band appeared in both lib/api/products.ts
// and lib/api/purchase-orders.ts). Keeping one copy here prevents them drifting.

return [
    // Product.totalStock < minStock => "kritik"; < minStock * low_multiplier => "dusuk"
    'low_stock_multiplier' => 1.5,

    // Warehouse capacity usage% tone thresholds
    'capacity_warning_percent' => 70,
    'capacity_critical_percent' => 90,

    // Supplier scorecard performance tone thresholds
    'performance_good_percent' => 85,
    'performance_warning_percent' => 60,

    // Demo login password shared by every seeded user.
    'demo_password' => env('DEMO_PASSWORD', 'demo1234'),
];
