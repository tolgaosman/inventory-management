<?php

namespace App\Support;

/**
 * Shared stock-math used across products/categories/warehouses/dashboard so
 * the "kritik/düşük/normal/fazla" bands and stock totals can't drift between
 * endpoints the way they could in the frontend mock (duplicated 1.5x constant
 * in lib/api/products.ts and lib/api/purchase-orders.ts).
 */
class InventoryCalc
{
    /** @param array<int, array{productId:string, warehouseId:string, quantity:int}> $stockLevels
     *  @return array<string, int> productId => total quantity across all warehouses */
    public static function totalsByProduct(array $stockLevels): array
    {
        $totals = [];
        foreach ($stockLevels as $row) {
            $totals[$row['productId']] = ($totals[$row['productId']] ?? 0) + $row['quantity'];
        }

        return $totals;
    }

    /** @return array<string, int> productId => quantity, for one warehouse */
    public static function totalsByProductInWarehouse(array $stockLevels, string $warehouseId): array
    {
        $totals = [];
        foreach ($stockLevels as $row) {
            if ($row['warehouseId'] === $warehouseId) {
                $totals[$row['productId']] = ($totals[$row['productId']] ?? 0) + $row['quantity'];
            }
        }

        return $totals;
    }

    public static function isCritical(array $product, int $totalStock): bool
    {
        return $totalStock < $product['minStock'];
    }

    public static function isLow(array $product, int $totalStock): bool
    {
        return ! self::isCritical($product, $totalStock)
            && $totalStock < $product['minStock'] * config('inventory.low_stock_multiplier');
    }

    public static function isOverstock(array $product, int $totalStock): bool
    {
        return $totalStock > $product['maxStock'];
    }

    /** @return 'kritik'|'dusuk'|'normal'|'fazla' */
    public static function stockStatus(array $product, int $totalStock): string
    {
        if (self::isCritical($product, $totalStock)) {
            return 'kritik';
        }
        if (self::isLow($product, $totalStock)) {
            return 'dusuk';
        }
        if (self::isOverstock($product, $totalStock)) {
            return 'fazla';
        }

        return 'normal';
    }

    public static function capacityTone(float $percent): string
    {
        if ($percent >= config('inventory.capacity_critical_percent')) {
            return 'red';
        }
        if ($percent >= config('inventory.capacity_warning_percent')) {
            return 'amber';
        }

        return 'green';
    }
}
