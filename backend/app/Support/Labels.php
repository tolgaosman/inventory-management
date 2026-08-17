<?php

namespace App\Support;

/** Turkish display labels resolved server-side, mirroring frontend/lib/constants.ts's MOVEMENT_REASON_LABELS etc. */
class Labels
{
    public const MOVEMENT_REASON = [
        'satin_alma' => 'Satın Alma',
        'satis' => 'Satış',
        'iade' => 'İade',
        'fire' => 'Fire',
        'sayim_duzeltme' => 'Sayım Düzeltme',
        'transfer' => 'Transfer',
    ];

    public const MOVEMENT_TYPE = [
        'giris' => 'Giriş',
        'cikis' => 'Çıkış',
        'transfer' => 'Transfer',
    ];

    public const PURCHASE_ORDER_STATUS = [
        'draft' => 'Taslak',
        'ordered' => 'Sipariş Edildi',
        'partially_received' => 'Kısmen Teslim Alındı',
        'received' => 'Teslim Alındı',
        'cancelled' => 'İptal Edildi',
    ];

    public static function movementReason(string $reason): string
    {
        return self::MOVEMENT_REASON[$reason] ?? $reason;
    }

    public static function movementType(string $type): string
    {
        return self::MOVEMENT_TYPE[$type] ?? $type;
    }

    public static function purchaseOrderStatus(string $status): string
    {
        return self::PURCHASE_ORDER_STATUS[$status] ?? $status;
    }
}
