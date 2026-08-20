<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\QuoteRequest;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\StockService;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Personal "recently deleted by me" bin, surfaced at the bottom of Ayarlar.
 * Only shows records the current user soft-deleted themselves (deleted_by =
 * their own id) — each resource's own ?trashed=1 admin filter (where it
 * exists) is the system-wide view, this is not that.
 */
class TrashController extends Controller
{
    private const TYPES = [
        'product' => Product::class,
        'category' => Category::class,
        'supplier' => Supplier::class,
        'warehouse' => Warehouse::class,
        'user' => User::class,
        'purchaseOrder' => PurchaseOrder::class,
        'quoteRequest' => QuoteRequest::class,
        'movement' => StockMovement::class,
    ];

    public function __construct(private StockService $stock)
    {
    }

    private function label(string $type, $model): string
    {
        return match ($type) {
            'product', 'category', 'supplier', 'warehouse', 'user' => (string) $model->name,
            'purchaseOrder', 'quoteRequest' => (string) $model->code,
            'movement' => match ($model->type) {
                'giris' => "Stok Girişi · {$model->quantity} adet",
                'cikis' => "Stok Çıkışı · {$model->quantity} adet",
                default => "Transfer · {$model->quantity} adet",
            },
        };
    }

    public function index(Request $request)
    {
        $userId = $request->user()->getKey();

        $rows = [];
        foreach (self::TYPES as $type => $class) {
            $items = $class::query()->onlyTrashed()->where('deleted_by', $userId)->get();
            foreach ($items as $model) {
                $rows[] = [
                    'type' => $type,
                    'id' => $model->id,
                    'label' => $this->label($type, $model),
                    'deletedAt' => Present::date($model->deleted_at),
                ];
            }
        }

        usort($rows, fn ($a, $b) => strcmp($b['deletedAt'] ?? '', $a['deletedAt'] ?? ''));

        return response()->json(array_values($rows));
    }

    public function restore(Request $request, string $type, string $id)
    {
        if (! array_key_exists($type, self::TYPES)) {
            throw ApiException::notFound('Geçersiz kayıt türü.');
        }

        $class = self::TYPES[$type];
        $userId = $request->user()->getKey();

        DB::transaction(function () use ($class, $type, $id, $userId) {
            $model = $class::query()->withTrashed()->where('id', $id)->lockForUpdate()->first();
            if (! $model || $model->deleted_by !== $userId) {
                throw ApiException::notFound('Kayıt bulunamadı.');
            }

            if ($type === 'movement') {
                $this->stock->reapplyMovement($model);
            }

            $model->restoreTracked();
        });

        return response()->json(['restored' => true]);
    }
}
