<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\QuoteRequest;
use App\Services\PurchaseOrderService;
use App\Support\IdGenerator;
use App\Support\Present;
use App\Support\TextTools;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Teklif İstekleri (RFQ) — a quote request sent to a supplier (existing or a
 * brand-new one, name-only) for a hand-picked list of items. Independent of
 * purchase orders: the buyer only places a real order once the supplier
 * responds with pricing. Port of frontend/lib/api/quotes.ts.
 */
class QuoteRequestController extends Controller
{
    public function __construct(private PurchaseOrderService $orders)
    {
    }

    private function toRow(QuoteRequest $q): array
    {
        return Present::quoteRequest($q) + [
            'supplierName' => $q->supplier->name ?? $q->adhoc_supplier_name ?? '-',
            'itemCount' => $q->items->count(),
            'total' => (float) $q->items->sum(fn ($i) => (int) $i->quantity * (float) ($i->unit_price ?? 0)),
        ];
    }

    public function index(Request $request)
    {
        $rows = QuoteRequest::query()->when($request->query('trashed') === '1', fn($q) => $q->onlyTrashed())
            ->with(['items', 'supplier', 'createdByUser', 'approvedByUser'])
            ->when($request->query('supplierId'), fn ($q, $id) => $q->where('supplier_id', $id))
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->query('excludeStatus'), fn ($q, $s) => $q->where('status', '!=', $s))
            ->when($request->query('created_by'), fn ($q, $c) => $q->where('created_by', $c))
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn ($q) => TextTools::matches([$q->code, $q->supplier->name ?? $q->adhoc_supplier_name ?? null], $request->query('search')))
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
        $quote = QuoteRequest::query()->with(['items', 'supplier', 'createdByUser', 'approvedByUser'])->find($id);
        if (! $quote) {
            throw ApiException::notFound('Teklif isteği bulunamadı.');
        }

        $productsById = Product::query()->whereIn('id', $quote->items->pluck('product_id')->filter())->get()->keyBy('id');

        $items = $quote->items->map(fn ($i) => [
            'productId' => $i->product_id,
            'productName' => $i->product_name,
            'sku' => ($p = $productsById->get($i->product_id)) ? $p->sku : null,
            'unit' => $i->unit,
            'quantity' => (int) $i->quantity,
            'unitPrice' => $i->unit_price !== null ? (float) $i->unit_price : null,
        ])->values()->all();

        return response()->json($this->toRow($quote) + [
            'supplier' => $quote->supplier ? Present::supplier($quote->supplier) : null,
            'items' => $items,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplierId' => ['nullable', 'string', 'exists:suppliers,id'],
            'adhocSupplierName' => ['nullable', 'string'],
            'adhocSupplierEmail' => ['nullable', 'string', 'email'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.productId' => ['nullable', 'string'],
            'items.*.productName' => ['nullable', 'string'],
            'items.*.unit' => ['nullable', 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
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

        $supplierId = $data['supplierId'] ?? null;
        $adhocSupplierName = trim($data['adhocSupplierName'] ?? '');
        $adhocSupplierEmail = trim($data['adhocSupplierEmail'] ?? '');
        if (! $supplierId && $adhocSupplierName === '') {
            throw ApiException::validation('Bir tedarikçi seçin veya yeni tedarikçi adı girin.');
        }
        if (! $supplierId && $adhocSupplierEmail === '') {
            throw ApiException::validation('Yeni tedarikçi için e-posta adresi girin.');
        }
        if (trim($data['deliveryAddress']) === '') {
            throw ApiException::validation('Teslim adresi gereklidir.');
        }

        $productIds = collect($data['items'])->pluck('productId')->filter()->unique()->values();
        $productsById = Product::query()->whereIn('id', $productIds)->get()->keyBy('id');
        if ($productsById->count() !== $productIds->count()) {
            throw ApiException::validation('Ürün bulunamadı.');
        }
        foreach ($data['items'] as $item) {
            $hasProduct = ! empty($item['productId']);
            $hasAdhoc = ! empty($item['productName']) && ! empty($item['unit']);
            if (! $hasProduct && ! $hasAdhoc) {
                throw ApiException::validation('Her kalem için bir ürün seçin veya ürün adı ve birim girin.');
            }
        }

        $quote = DB::transaction(function () use ($data, $request, $supplierId, $adhocSupplierName, $adhocSupplierEmail, $productsById) {
            $user = $request->user();
            // Same rule as purchase orders: approvers' own quotes go out immediately,
            // everyone else's waits for an approver to sign off.
            $isApprover = $user->can('purchase.approve');

            $quote = QuoteRequest::query()->create([
                'id' => IdGenerator::nextId('quote_requests', 'id', 'qr', 4),
                'code' => IdGenerator::nextCode('quote_requests', 'code', 'NET-TKL-'),
                'supplier_id' => $supplierId,
                'adhoc_supplier_name' => $supplierId ? null : $adhocSupplierName,
                'adhoc_supplier_email' => $supplierId ? null : $adhocSupplierEmail,
                'created_at' => Carbon::now(),
                'created_by' => $user->getKey(),
                'valid_until' => $data['validUntil'],
                'delivery_date' => $data['deliveryDate'],
                'delivery_address' => trim($data['deliveryAddress']),
                'payment_terms' => trim($data['paymentTerms'] ?? ''),
                'requested_currency' => $data['requestedCurrency'],
                'contact_name' => trim($data['contactName']),
                'contact_email' => trim($data['contactEmail']),
                'contact_phone' => trim($data['contactPhone']),
                'notes' => trim($data['notes'] ?? '') ?: null,
                'status' => $isApprover ? 'approved' : 'pending_approval',
                'approved_by' => $isApprover ? $user->getKey() : null,
                'approved_at' => $isApprover ? Carbon::now() : null,
            ]);

            foreach ($data['items'] as $item) {
                $product = ! empty($item['productId']) ? $productsById->get($item['productId']) : null;
                $quote->items()->create([
                    'product_id' => $product?->id,
                    'product_name' => $product?->name ?? trim($item['productName'] ?? ''),
                    'unit' => $product?->unit ?? trim($item['unit'] ?? ''),
                    'quantity' => (int) $item['quantity'],
                    'unit_price' => null,
                ]);
            }

            return $quote;
        });

        return response()->json(Present::quoteRequest($quote->fresh(['items', 'createdByUser'])), 201);
    }

    private function transitionApproval(Request $request, string $id, string $to, string $conflictMessage): object
    {
        $quote = DB::transaction(function () use ($request, $id, $to, $conflictMessage) {
            $quote = QuoteRequest::query()->lockForUpdate()->find($id);
            if (! $quote) {
                throw ApiException::notFound('Teklif isteği bulunamadı.');
            }
            if ($quote->status !== 'pending_approval') {
                throw ApiException::conflict($conflictMessage);
            }

            $quote->status = $to;
            $quote->approved_by = $request->user()->getKey();
            $quote->approved_at = Carbon::now();
            $quote->save();

            return $quote;
        });

        return response()->json(Present::quoteRequest($quote->fresh(['items', 'createdByUser'])));
    }

    public function approve(Request $request, string $id)
    {
        return $this->transitionApproval($request, $id, 'approved', 'Yalnızca onay bekleyen teklifler onaylanabilir.');
    }

    /**
     * A rejected quote isn't kept around in "rejected" state — it's simply
     * removed, since the whole point of the ad-hoc quote flow is that nothing
     * is committed until the supplier responds with acceptable pricing.
     */
    public function reject(Request $request, string $id)
    {
        DB::transaction(function () use ($request, $id) {
            $quote = QuoteRequest::query()->lockForUpdate()->find($id);
            if (! $quote) {
                throw ApiException::notFound('Teklif isteği bulunamadı.');
            }
            if ($quote->status !== 'pending_approval') {
                throw ApiException::conflict('Yalnızca onay bekleyen teklifler reddedilebilir.');
            }

            $quote->deleteAs($request->user()->getKey());
        });

        return response()->json(['deleted' => true]);
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
            ->with(['items', 'supplier', 'createdByUser'])
            ->when($supplierId, fn ($q, $id) => $q->where('supplier_id', $id))
            ->get()
            ->filter(fn ($q) => TextTools::matches([$q->code, $q->supplier->name ?? $q->adhoc_supplier_name ?? null], $search))
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

    public function destroy(Request $request, string $id)
    {
        DB::transaction(function () use ($request, $id) {
            $quote = QuoteRequest::query()->lockForUpdate()->find($id);
            if (! $quote) {
                throw ApiException::notFound('Teklif isteği bulunamadı.');
            }

            $quote->deleteAs($request->user()->getKey());
        });

        return response()->json(['deleted' => true]);
    }

    public function restore(string $id)
    {
        $model = \App\Models\QuoteRequest::withTrashed()->find($id);
        if (!$model) {
            throw \App\Exceptions\ApiException::notFound('Kayıt bulunamadı.');
        }
        $model->restoreTracked();
        return response()->json(['restored' => true]);
    }
}
