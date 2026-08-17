<?php

// Direct PHP port of frontend/lib/auth.tsx's ROLE_PERMISSIONS map (12 permissions, 3 roles).
// Keep in sync manually — the frontend still enforces its own copy client-side for UI gating,
// but this is now the source of truth servers must not be bypassed by editing requests.

return [
    'roles' => ['depo', 'satinalma', 'yonetici'],

    'permissions' => [
        'products.view', 'products.manage',
        'warehouses.manage',
        'stock.in', 'stock.out', 'stock.transfer',
        'purchase.view', 'purchase.manage',
        'suppliers.view', 'suppliers.manage',
        'reports.view',
        'users.manage',
    ],

    'role_permissions' => [
        'depo' => ['products.view', 'stock.in', 'stock.out', 'stock.transfer'],
        'satinalma' => ['products.view', 'purchase.view', 'purchase.manage', 'suppliers.view', 'suppliers.manage'],
        'yonetici' => [
            'products.view', 'products.manage',
            'warehouses.manage',
            'stock.in', 'stock.out', 'stock.transfer',
            'purchase.view', 'purchase.manage',
            'suppliers.view', 'suppliers.manage',
            'reports.view',
            'users.manage',
        ],
    ],
];
