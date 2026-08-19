<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\MovementController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\QuoteRequestController;

use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\SupplierScorecardController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WarehouseController;
use App\Http\Middleware\EnsurePasswordChanged;
use Illuminate\Support\Facades\Route;

Route::get('/ping', fn () => response()->json(['ok' => true]));

Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:6,1');
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:6,1');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:6,1');

Route::middleware(['auth:sanctum', EnsurePasswordChanged::class])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword'])->middleware('throttle:writes');

    // Categories
    Route::get('/categories/tree', [CategoryController::class, 'tree'])->middleware('perm:products.view');
    Route::post('/categories', [CategoryController::class, 'store'])->middleware(['perm:products.manage', 'throttle:writes']);
    Route::put('/categories/{id}', [CategoryController::class, 'update'])->middleware(['perm:products.manage', 'throttle:writes']);
    Route::delete('/categories/{id}', [CategoryController::class, 'destroy'])->middleware(['perm:products.manage', 'throttle:writes']);

    // Warehouses
    Route::get('/warehouses', [WarehouseController::class, 'index'])->middleware('perm:products.view');
    Route::get('/warehouses/detailed', [WarehouseController::class, 'detailed'])->middleware('perm:products.view');
    Route::get('/warehouses/stock-matrix', [WarehouseController::class, 'stockMatrix'])->middleware('perm:products.view');
    Route::get('/warehouses/{id}', [WarehouseController::class, 'show'])->middleware('perm:products.view');
    Route::post('/warehouses', [WarehouseController::class, 'store'])->middleware(['perm:warehouses.manage', 'throttle:writes']);
    Route::put('/warehouses/{id}', [WarehouseController::class, 'update'])->middleware(['perm:warehouses.manage', 'throttle:writes']);
    Route::delete('/warehouses/{id}', [WarehouseController::class, 'destroy'])->middleware(['perm:warehouses.manage', 'throttle:writes']);

    // Suppliers
    Route::get('/suppliers', [SupplierController::class, 'index'])->middleware('perm:suppliers.view');
    Route::get('/suppliers/scorecards', [SupplierScorecardController::class, 'index'])->middleware('perm:suppliers.view');
    Route::get('/suppliers/{id}', [SupplierController::class, 'show'])->middleware('perm:suppliers.view');
    Route::post('/suppliers', [SupplierController::class, 'store'])->middleware(['perm:suppliers.manage', 'throttle:writes']);
    Route::put('/suppliers/{id}', [SupplierController::class, 'update'])->middleware(['perm:suppliers.manage', 'throttle:writes']);
    Route::delete('/suppliers/{id}', [SupplierController::class, 'destroy'])->middleware(['perm:suppliers.manage', 'throttle:writes']);

    // Products
    Route::get('/products', [ProductController::class, 'index'])->middleware('perm:products.view');
    Route::get('/products/{id}', [ProductController::class, 'show'])->middleware('perm:products.view');
    Route::get('/products/{id}/stock', [ProductController::class, 'stockByWarehouse'])->middleware('perm:products.view');
    Route::get('/products/{id}/history', [ProductController::class, 'history'])->middleware('perm:products.view');
    Route::post('/products', [ProductController::class, 'store'])->middleware(['perm:products.manage', 'throttle:writes']);
    Route::put('/products/{id}', [ProductController::class, 'update'])->middleware(['perm:products.manage', 'throttle:writes']);
    Route::patch('/products/{id}/status', [ProductController::class, 'toggleStatus'])->middleware(['perm:products.manage', 'throttle:writes']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy'])->middleware(['perm:products.manage', 'throttle:writes']);
    Route::post('/products/bulk-status', [ProductController::class, 'bulkStatus'])->middleware(['perm:products.manage', 'throttle:bulk']);
    Route::post('/products/bulk-delete', [ProductController::class, 'bulkDelete'])->middleware(['perm:products.manage', 'throttle:bulk']);
    Route::post('/products/import', [ProductController::class, 'bulkImport'])->middleware(['perm:products.manage', 'throttle:bulk']);

    // Stock movements
    Route::get('/movements', [MovementController::class, 'index'])->middleware('perm:stock.view');
    Route::post('/stock/in', [MovementController::class, 'stockIn'])->middleware(['perm:stock.in', 'throttle:writes']);
    Route::post('/stock/out', [MovementController::class, 'stockOut'])->middleware(['perm:stock.out', 'throttle:writes']);
    Route::post('/stock/transfer', [MovementController::class, 'transfer'])->middleware(['perm:stock.transfer', 'throttle:writes']);
    Route::get('/stock/quantity', [MovementController::class, 'quantity'])->middleware('perm:products.view');

    // Purchase orders
    Route::get('/purchase-orders/stats', [PurchaseOrderController::class, 'stats'])->middleware('perm:purchase.view');
    Route::get('/purchase-orders/quotable-grouped', [QuoteRequestController::class, 'quotableGrouped'])->middleware('perm:purchase.view');
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index'])->middleware('perm:purchase.view');
    Route::get('/purchase-orders/{id}', [PurchaseOrderController::class, 'show'])->middleware('perm:purchase.view');
    Route::post('/purchase-orders', [PurchaseOrderController::class, 'store'])->middleware(['perm:purchase.manage', 'throttle:writes']);
    Route::put('/purchase-orders/{id}', [PurchaseOrderController::class, 'update'])->middleware(['perm:purchase.manage', 'throttle:writes']);
    Route::delete('/purchase-orders/{id}', [PurchaseOrderController::class, 'destroy'])->middleware(['perm:purchase.manage', 'throttle:writes']);
    Route::post('/purchase-orders/{id}/order', [PurchaseOrderController::class, 'markOrdered'])->middleware(['perm:purchase.approve', 'throttle:writes']);
    Route::post('/purchase-orders/{id}/request-approval', [PurchaseOrderController::class, 'requestApproval'])->middleware(['perm:purchase.manage', 'throttle:writes']);
    Route::post('/purchase-orders/{id}/approve', [PurchaseOrderController::class, 'approve'])->middleware(['perm:purchase.approve', 'throttle:writes']);
    Route::post('/purchase-orders/{id}/reject', [PurchaseOrderController::class, 'reject'])->middleware(['perm:purchase.approve', 'throttle:writes']);
    Route::post('/purchase-orders/{id}/receive', [PurchaseOrderController::class, 'receive'])->middleware(['perm:purchase.manage|purchase.receive', 'throttle:bulk']);
    Route::post('/purchase-orders/{id}/invoice', [PurchaseOrderController::class, 'uploadInvoice'])->middleware(['perm:purchase.manage|purchase.receive', 'throttle:bulk']);
    Route::post('/purchase-orders/{id}/cancel', [PurchaseOrderController::class, 'cancel'])->middleware(['perm:purchase.manage', 'throttle:writes']);
    Route::post('/purchase-orders/bulk-order', [PurchaseOrderController::class, 'bulkOrder'])->middleware(['perm:purchase.approve', 'throttle:bulk']);
    Route::post('/purchase-orders/bulk-cancel', [PurchaseOrderController::class, 'bulkCancel'])->middleware(['perm:purchase.manage', 'throttle:bulk']);
    Route::post('/purchase-orders/bulk-delete', [PurchaseOrderController::class, 'bulkDelete'])->middleware(['perm:purchase.manage', 'throttle:bulk']);

    // Quote requests (RFQ / Teklif İstekleri)
    Route::get('/quotes-and-invoices', [QuoteRequestController::class, 'quotesAndInvoices'])->middleware('perm:purchase.view');
    Route::get('/quote-requests', [QuoteRequestController::class, 'index'])->middleware('perm:purchase.view');
    Route::get('/quote-requests/{id}', [QuoteRequestController::class, 'show'])->middleware('perm:purchase.view');
    Route::post('/quote-requests', [QuoteRequestController::class, 'store'])->middleware(['perm:purchase.manage', 'throttle:writes']);
    Route::post('/quote-requests/{id}/approve', [QuoteRequestController::class, 'approve'])->middleware(['perm:purchase.approve', 'throttle:writes']);
    Route::post('/quote-requests/{id}/reject', [QuoteRequestController::class, 'reject'])->middleware(['perm:purchase.approve', 'throttle:writes']);


    // Dashboard + notifications
    Route::get('/dashboard', [DashboardController::class, 'show'])->middleware('perm:products.view');
    Route::get('/notifications/critical-stock', [DashboardController::class, 'criticalStockNotifications'])->middleware('perm:products.view');

    // Reports
    Route::get('/reports/products', [ReportController::class, 'products'])->middleware('perm:reports.stock|reports.financial');
    Route::get('/reports/warehouses', [ReportController::class, 'warehouses'])->middleware('perm:reports.stock|reports.financial');
    Route::get('/reports/movements', [ReportController::class, 'movements'])->middleware('perm:reports.stock|reports.financial');
    Route::get('/reports/purchasing', [ReportController::class, 'purchasing'])->middleware('perm:reports.stock|reports.financial');

    // Calendar
    Route::get('/calendar', [CalendarController::class, 'index'])->middleware('perm:products.view');

    // Users
    Route::get('/users', [UserController::class, 'index'])->middleware('perm:users.manage');
    Route::post('/users', [UserController::class, 'store'])->middleware(['perm:users.manage', 'throttle:writes']);
    Route::put('/users/{id}', [UserController::class, 'update'])->middleware(['perm:users.manage', 'throttle:writes']);
    Route::delete('/users/{id}', [UserController::class, 'destroy'])->middleware(['perm:users.manage', 'throttle:writes']);

    // Settings — every authenticated role may read/update (company profile, own notification prefs).
    Route::get('/settings', [SettingsController::class, 'show']);
    Route::put('/settings', [SettingsController::class, 'update'])->middleware('throttle:writes');
});
