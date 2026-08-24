<?php

// Canonical registry of assignable permission keys — this is the checklist the
// "Roller" admin page renders. Role → permission mapping itself now lives in
// the `roles`/`role_permissions` tables (see database/migrations/*_create_roles_tables.php
// and App\Models\Role) rather than here; User::permissions() reads that table.
// The frontend receives a user's resolved permission list on login and uses it
// only to hide UI the user couldn't use anyway — every route is enforced here
// (or via the `admin` middleware for role management) too, so editing requests
// client-side buys nothing.

return [
    'permissions' => [
        // Dashboard: 'dashboard.view' is the master switch for the /panel page;
        // the rest gate individual widgets on it.
        'dashboard.view',
        'dashboard.kpis', 'dashboard.meta', 'dashboard.purchase_summary',
        'dashboard.category_chart', 'dashboard.recent_movements', 'dashboard.stock_flow',
        'dashboard.warehouse_stock', 'dashboard.top_movers', 'dashboard.critical_stock',
        'products.view', 'products.manage',
        'warehouses.view', 'warehouses.manage',
        'stock.view', 'stock.in', 'stock.out', 'stock.transfer',
        'purchase.view', 'purchase.manage', 'purchase.approve', 'purchase.receive',
        'suppliers.view', 'suppliers.manage',
        'reports.stock', 'reports.financial',
        'financial.view',
        'users.manage',
        'roles.manage',
    ],
];
