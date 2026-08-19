<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\QuoteRequest;
use App\Models\Warehouse;
use App\Services\PurchaseOrderService;
use App\Support\IdGenerator;
use App\Support\Present;
use App\Support\TextTools;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Teklif İstekleri (RFQ) — bundles one or more of a supplier's not-yet-sent
 * purchase orders into a single quote-request document. Port of
 * frontend/lib/api/quotes.ts.
 *
 * Line prices are snapshotted at creation time, so editing the source order
 * afterwards never rewrites a quote that has already gone out.
 */
class QuoteRequestController extends Controller
{
    /** Statuses a purchase order must be in to be quotable. */
    private const QUOTABLE = ['draft', 'pending_approval'];

    public function __construct(private PurchaseOrderService $orders)
    {
    }

    private function toRow(QuoteRequest $q): array
    {
        return Present::quoteRequest($q) + [
            'supplierName' => $q->supplier->name ?? '-',
            'orderCount' => $q->items->pluck('purchase_order_id')->unique()->count(),
            'itemCount' => $q->items->count(),
            'total' => (float) $q->items->sum(fn ($i) => (int) $i->quantity * (float) $i->unit_price),
        ];
    }

    public function index(Request $request)
    {
        $rows = QuoteRequest::query()
            ->with(['items', 'supplier'])
            ->when($request->query('supplierId'), fn ($q, $id) => $q->where('supplier_id', $id))
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn ($q) => TextTools::matches([$q->code, $q->supplier->name ?? null], $request->query('search')))
            ->map(fn ($q) => $this->toRow($q))
            ->values()
            ->all();

        return response()->json(TextTools::paginate(
            $rows,
            (int) $request->query('page', 1),
            (int) $request->query('pageSize', 10),
        ));
    }

    public function show(string $id)
    {
        $quote = QuoteRequest::query()->with(['items', 'supplier'])->find($id);
        if (! $quote) {
            throw ApiException::notFound('Teklif isteği bulunamadı.');
        }
        if (! $quote->supplier) {
            throw ApiException::notFound('Tedarikçi bulunamadı.');
        }

        $orderIds = $quote->items->pluck('purchase_order_id')->unique();
        $ordersById = PurchaseOrder::query()->whereIn('id', $orderIds)->get()->keyBy('id');
        $warehouseNames = Warehouse::query()->pluck('name', 'id');
        $productsById = Product::query()->whereIn('id', $quote->items->pluck('product_id'))->get()->keyBy('id');

        $orders = $orderIds->map(function ($poId) use ($ordersById, $warehouseNames, $productsById, $quote) {
            $po = $ordersById->get($poId);
            if (! $po) {
                throw ApiException::notFound('Kaynak sipariş bulunamadı.');
            }

            return [
                'id' => $po->id,
                'code' => $po->code,
                'expectedAt' => Present::date($po->expected_at),
                'warehouseName' => $warehouseNames[$po->warehouse_id] ?? '-',
                'items' => $quote->items
                    ->where('purchase_order_id', $po->id)
                    ->map(fn ($i) => [
                        'productId' => $i->product_id,
                        'quantity' => (int) $i->quantity,
                        'unitPrice' => (float) $i->unit_price,
                        'product' => ($p = $productsById->get($i->product_id)) ? Present::product($p) : null,
                    ])
                    ->values()
                    ->all(),
            ];
        })->values()->all();

        return response()->json($this->toRow($quote) + ['supplier' => Present::supplier($quote->supplier), 'orders' => $orders]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'purchaseOrderIds' => ['required', 'array'],
            'purchaseOrderIds.*' => ['string'],
            'validUntil' => ['required', 'string'],
            'deliveryDate' => ['required', 'string'],
            'deliveryAddress' => ['required', 'string'],
            'paymentTerms' => ['nullable', 'string'],
            'requestedCurrency' => ['required', 'in:try,usd,eur,gbp'],
            'contactName' => ['required', 'string'],
            'contactEmail' => ['required', 'string'],
            'contactPhone' => ['required', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        if (count($data['purchaseOrderIds']) === 0) {
            throw ApiException::validation('En az bir sipariş seçin.');
        }
        if (trim($data['deliveryAddress']) === '') {
            throw ApiException::validation('Teslim adresi gereklidir.');
        }

        $quote = DB::transaction(function () use ($data, $request) {
            $orders = PurchaseOrder::query()
                ->with('items')
                ->lockForUpdate()
                ->whereIn('id', $data['purchaseOrderIds'])
                ->get();

            if ($orders->count() !== count(array_unique($data['purchaseOrderIds']))) {
                throw ApiException::validation('Sipariş bulunamadı.');
            }
            if ($orders->contains(fn ($po) => ! in_array($po->status, self::QUOTABLE, true))) {
                throw ApiException::validation('Yalnızca taslak veya onay bekleyen siparişler için teklif formu oluşturulabilir.');
            }

            $supplierId = $orders->first()->supplier_id;
            if ($orders->contains(fn ($po) => $po->supplier_id !== $supplierId)) {
                throw ApiException::validation('Seçilen siparişler aynı tedarikçiye ait olmalı.');
            }

            $quote = QuoteRequest::query()->create([
                'id' => IdGenerator::nextId('quote_requests', 'id', 'qr', 4),
                'code' => IdGenerator::nextCode('quote_requests', 'code', 'NET-TKL-'),
                'supplier_id' => $supplierId,
                'created_at' => Carbon::now(),
                'created_by' => $request->user()->getKey(),
                'valid_until' => $data['validUntil'],
                'delivery_date' => $data['deliveryDate'],
                'delivery_address' => trim($data['deliveryAddress']),
                'payment_terms' => trim($data['paymentTerms'] ?? ''),
                'requested_currency' => $data['requestedCurrency'],
                'contact_name' => trim($data['contactName']),
                'contact_email' => trim($data['contactEmail']),
                'contact_phone' => trim($data['contactPhone']),
                'notes' => trim($data['notes'] ?? '') ?: null,
            ]);

            foreach ($orders as $po) {
                foreach ($po->items as $item) {
                    $quote->items()->create([
                        'purchase_order_id' => $po->id,
                        'product_id' => $item->product_id,
                        'quantity' => (int) $item->quantity,
                        'unit_price' => (float) $item->unit_price,
                    ]);
                }
            }

            return $quote;
        });

        return response()->json(Present::quoteRequest($quote->fresh(['items'])), 201);
    }

    /** Quotable orders grouped by supplier, for the supplier-selection dialog. */
    public function quotableGrouped()
    {
        $grouped = [];

        foreach (PurchaseOrder::query()->with('items')->whereIn('status', self::QUOTABLE)->get() as $po) {
            $grouped[$po->supplier_id][] = [
                'id' => $po->id,
                'code' => $po->code,
                'supplierId' => $po->supplier_id,
                'status' => $po->status,
                'itemCount' => $po->items->count(),
                'total' => PurchaseOrderService::total($po),
                'expectedAt' => Present::date($po->expected_at),
            ];
        }

        return response()->json((object) $grouped);
    }

    /**
     * Combined feed: quote requests plus received/partially-received orders
     * presented as "invoices". Merged first, then paginated, so the two kinds
     * interleave by date instead of being paged separately.
     */
    public function quotesAndInvoices(Request $request)
    {
        $supplierId = $request->query('supplierId');
        $search = $request->query('search');

        $quotes = QuoteRequest::query()
            ->with(['items', 'supplier'])
            ->when($supplierId, fn ($q, $id) => $q->where('supplier_id', $id))
            ->get()
            ->filter(fn ($q) => TextTools::matches([$q->code, $q->supplier->name ?? null], $search))
            ->map(fn ($q) => $this->toRow($q) + ['type' => 'quote']);

        $invoices = PurchaseOrder::query()
            ->with(['items', 'supplier'])
            ->whereIn('status', ['received', 'partially_received'])
            ->when($supplierId, fn ($q, $id) => $q->where('supplier_id', $id))
            ->get()
            ->filter(fn ($po) => TextTools::matches([$po->code, $po->supplier->name ?? null], $search))
            ->map(fn ($po) => [
                'type' => 'invoice',
                'id' => $po->id,
                'code' => $po->code,
                'supplierName' => $po->supplier->name ?? '-',
                'orderCount' => 1,
                'itemCount' => $po->items->count(),
                'createdAt' => Present::date($po->created_at),
                // The UI reuses this column as the invoice's reference date.
                'validUntil' => Present::date($po->expected_at),
                'createdBy' => 'Sistem',
                'total' => PurchaseOrderService::total($po),
            ]);

        $combined = $quotes->concat($invoices)
            ->sortByDesc('createdAt')
            ->values()
            ->all();

        return response()->json(TextTools::paginate(
            $combined,
            (int) $request->query('page', 1),
            (int) $request->query('pageSize', 10),
        ));
    }
}
