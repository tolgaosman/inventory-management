@AGENTS.md

# Recent Work (uncommitted, since the CLAUDE.md file was created 2026-08-10)

Everything below is still sitting in the working tree — `git status` shows it as modified/untracked, not yet committed. Written so a fresh session knows what exists in the app right now without re-deriving it from a cold read of every file.

## Satın Alma (Purchase Orders) — flagship page

`/satin-alma` was rebuilt into the app's most functionally dense page: full CRUD (list/detail/create/edit), receive-to-stock, cancel, delete, all gated through `Can`/`useAuth` permissions (`purchase.view`/`purchase.manage`).

Structure is "command center": a dark hero block (`components/purchase-orders/purchase-command-hero.tsx`) above three tabs (`components/purchase-orders/purchase-orders-client.tsx`):
- **Siparişler** — the order list/table, with row selection, bulk send/cancel/delete, a depo filter, an "sadece gecikenler" toggle, and filtered/selection-aware Excel/PDF export.
- **İkmal Önerileri** (`replenishment-panel.tsx` + `replenishment-order-dialog.tsx`) — a reorder-suggestion engine: cross-references stock, open-order coverage, and `Product.maxStock` to flag what needs reordering, with editable quantities and one-click bulk draft-order creation grouped by supplier.
- **Tedarikçi Karnesi** (`supplier-scorecard-panel.tsx`) — per-supplier fill rate, on-time-delivery %, and average lead time, sortable.

Backing logic lives in `lib/api/purchase-orders.ts` (`getPurchaseOrderStats`, `getReplenishmentSuggestions`, `createPurchaseOrdersFromSuggestions`, `getSupplierScorecards`, `bulkMarkPurchaseOrdersOrdered`/`bulkCancelPurchaseOrders`/`bulkDeletePurchaseOrders`) and `lib/purchase-order-actions.ts` (`getAvailableActions` — the single source of truth for which actions a PO status allows, shared by the list and detail views so they can't drift).

**Schema additions** (additive, in `lib/types.ts`): `PurchaseOrder.receivedAt` (stamped when a PO is fully received — the only real delivery timestamp in the schema) and `StockMovement.purchaseOrderId` (ties a "giriş" movement back to the PO that created it). Backfilled into the mock seed (`lib/mock/data.ts`) with realistic ±jitter so on-time-delivery % isn't a suspicious 100%.

The tab state reads an optional `?tab=` query param on mount (not fully URL-synced, just a one-time deep-link read) so other pages can link straight into e.g. the scorecard tab.

## Command-hero pattern rolled out to 4 more pages

The dark "hero" surface + big headline number + tick meter + clickable filter chips, originally built for satın alma, was extracted into a shared primitive: `components/common/command-hero.tsx` (`CommandHero`). `purchase-command-hero.tsx` now just wraps it. Four more pages adopted it, each with its own thin wrapper component:

- **Ürünler** — `products-command-hero.tsx`. Headline: total inventory value. Chips: toplam ürün, kritik stok, düşük stok, **stok fazlası** (new — first use of `Product.maxStock` as an aggregate), pasif ürün (new — `ProductQuery` gained a `status` filter that didn't exist before).
- **Depolar** — `warehouse-command-hero.tsx`. Headline: total inventory value across warehouses. Chips: toplam depo, toplam stok adedi, kritik doluluk (≥90%, new — drives a `capacityFilter` that narrows the warehouse card grid), atıl kapasite (<30%, new), en değerli depo (reuses the existing warehouse-select-to-filter-matrix mechanism).
- **Stok Hareketleri** — `movement-command-hero.tsx`. Headline: today's net stock change (today wasn't a concept anywhere else on this page before — everything was all-time totals). Chips: toplam kayıt/giriş/çıkış/transfer (set the `type` filter), bugün (sets date range to today), fire/iade (new — `MovementQuery` gained a `reason` filter), en hareketli depo.
- **Tedarikçiler** — `supplier-command-hero.tsx`. Reuses `getSupplierScorecards()` from the satın alma module instead of recomputing anything; added two new columns to the supplier table (Açık Sipariş Hacmi, Zamanında Teslimat %). Chips: toplam tedarikçi/ürün çeşidi/şehir (overview), riskli tedarikçi (on-time < 60%, deep-links to `/satin-alma?tab=scorecard` rather than rebuilding the sortable scorecard on this page), ürünsüz tedarikçi (client-side filter toggle).

On all four pages, the old separate white `StatGrid` card row below the hero was removed — its numbers were folded into the hero itself as additional chips so nothing is shown twice.

Panel (`/panel`) was deliberately left untouched — it already uses the `inverse`/`hero` `PanelCard` variants throughout, just in a different (grid-embedded) composition.

## Stok module consolidation

`/stok/transfer` (standalone transfer page/component) was deleted; transfer is now folded into `/stok/islem` alongside giriş/çıkış (`combined-movement-page.tsx`). Nav config (`nav-config.ts`) updated to match: "Giriş / Çıkış İşlemleri" + "Transfer" → single "Giriş / Çıkış / Transfer" entry.

## Raporlar — new Depolar tab

`reports-client.tsx` gained a warehouse-focused tab: `warehouse-capacity-radials.tsx` (per-warehouse capacity donuts, using the new `capacityFillVar` helper in `lib/capacity.ts`), `warehouse-value-chart.tsx`, `warehouse-movers-chart.tsx`, plus a category-distribution-per-warehouse panel and a "Satın Alma Siparişleri" section (status breakdown, top suppliers, monthly trend).

## Takvim — new page

`/takvim` (`components/calendar/calendar-client.tsx`) is a new monthly calendar view over stock movements and purchase orders — filterable by movement/order type, with a day-detail dialog. Not linked from `nav-config.ts` yet (check before assuming it's reachable from the sidebar).

## Shared infra touched along the way

- `components/data-table/data-table.tsx`: pagination gained first-page/last-page jump buttons (`ChevronsLeft`/`ChevronsRight`), not just prev/next.
- `lib/export/excel.ts` / `lib/export/pdf.ts`: status color-coding extended to cover all `PurchaseOrderStatus` values (Taslak/Sipariş Edildi/Kısmen Teslim Alındı/Teslim Alındı/İptal Edildi), not just stock movement types.
- `lib/capacity.ts`: added `capacityFillVar` (SVG-fill-safe version of the existing `capacityIndicatorClass` tone logic).
