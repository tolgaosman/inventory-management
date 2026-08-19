<?php

// Source of truth for authorization (17 permissions, 5 roles). The frontend receives this
// role's permission list on login and uses it only to hide UI the user couldn't use anyway —
// every route is enforced here too, so editing requests client-side buys nothing.
//
// Department split: the two "depo" roles own stock and warehouses, the two "satinalma" roles
// own purchasing and suppliers. Managers add users.manage (scoped to their own department by
// UserController) plus the reports permission for their side.

return [
    'roles' => ['admin', 'depo_yonetici', 'satinalma_yonetici', 'depo', 'satinalma'],

    'permissions' => [
        'products.view', 'products.manage',
        'warehouses.manage',
        'stock.view', 'stock.in', 'stock.out', 'stock.transfer',
        'purchase.view', 'purchase.manage', 'purchase.approve', 'purchase.receive',
        'suppliers.view', 'suppliers.manage',
        'reports.stock', 'reports.financial',
        'financial.view',
        'users.manage',
    ],

    'role_permissions' => [
        'depo' => [
            'products.view', 'products.manage',
            'stock.view', 'stock.in', 'stock.out', 'stock.transfer',
            'purchase.view', 'purchase.receive',
            'suppliers.view',
            'financial.view',
        ],
        'satinalma' => [
            'products.view',
            'stock.view',
            'purchase.view', 'purchase.manage',
            'suppliers.view',
            'financial.view',
        ],
        'depo_yonetici' => [
            'products.view', 'products.manage',
            'warehouses.manage',
            'stock.view', 'stock.in', 'stock.out', 'stock.transfer',
            'purchase.view', 'purchase.receive',
            'suppliers.view',
            'reports.stock',
            'financial.view',
            'users.manage',
        ],
        'satinalma_yonetici' => [
            'products.view',
            'stock.view',
            'purchase.view', 'purchase.manage', 'purchase.approve', 'purchase.receive',
            'suppliers.view', 'suppliers.manage',
            'reports.financial',
            'financial.view',
            'users.manage',
        ],
        'admin' => [
            'products.view', 'products.manage',
            'warehouses.manage',
            'stock.view', 'stock.in', 'stock.out', 'stock.transfer',
            'purchase.view', 'purchase.manage', 'purchase.approve', 'purchase.receive',
            'suppliers.view', 'suppliers.manage',
            'reports.stock', 'reports.financial',
            'financial.view',
            'users.manage',
        ],
    ],
];
