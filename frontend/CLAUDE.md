@AGENTS.md

# Recent Work (uncommitted, since the last commit `a665a1b` on 2026-08-17)

Everything below is still sitting in the working tree — `git status` shows it as modified/untracked, not yet committed. Written so a fresh session knows what exists in the app right now without re-deriving it from a cold read of every file. This supersedes anything below that talks about replenishment/İkmal Önerileri — that feature was ripped out (see below).

## RBAC overhaul: finer-grained permissions + department scoping

The permission set (`backend/config/permissions.php`, `frontend/lib/api/auth.ts`) was split more finely:
- `reports.view` → split into `reports.stock` and `reports.financial`.
- New `stock.view` (read-only movement history, distinct from `stock.in`/`stock.out`/`stock.transfer` which are write actions).
- New `purchase.approve` (gate on the approve/reject actions, previously bundled into `purchase.manage`) and `purchase.receive` (gate on receive/invoice-upload, so warehouse roles can receive POs without full `purchase.manage`).
- New `financial.view` — gates purchase/sale price visibility everywhere (see below).
- `depo_yonetici` and `satinalma_yonetici` both gained `users.manage`, but scoped: `UserController` (`backend/app/Http/Controllers/Api/UserController.php`) now filters `index()` and enforces on `store`/`update`/`destroy` so a `depo_yonetici` can only see/create/edit/delete `depo`/`depo_yonetici` users (and `satinalma_yonetici` likewise for `satinalma`/`satinalma_yonetici`), and only `admin` can change a user's `role`. `users-client.tsx` mirrors this in the UI: `roleOptions` is now computed from `currentUserRole` (via `useAuth`), and the promote/demote menu items are admin-only.
- `EnsurePermission` middleware (`backend/app/Http/Middleware/EnsurePermission.php`) now accepts pipe-delimited alternatives in the route middleware string (`perm:purchase.manage|purchase.receive`) and passes if the user has *any* one of them — used throughout `routes/api.php` for the new split permissions (receive, reports).
- Frontend `Can` (`components/common/can.tsx`) and `NavItem.permission` (`components/layout/nav-config.ts`) now accept `Permission | Permission[]` (any-of), not just a single permission — needed for the same OR-permission cases.

**financial.view** gates purchase/sale prices and stock-value figures across the app: `product-detail-client.tsx` (Alış/Satış Fiyatı fields, Stok Değeri card), `products-client.tsx` (salePrice column, min/max price filter). Roles without it (e.g. plain `depo`) see products/stock but not money.

## Purchase-order approval workflow surfaced in the header

`app-header.tsx` was reworked: for `satinalma_yonetici`, the notification bell now has two tabs (`Tabs`/`TabsList`/`TabsContent`) — "Kritik Stok" (unchanged critical-stock list) and "Onay Bekleyen" (pending-approval purchase orders, fetched via `listPurchaseOrders({ status: "pending_approval" })`). Other roles still see the old single-list bell. The old `notifications.notifyStock` on/off toggle gate was removed — critical-stock notifications are now always fetched, since the "Bildirim Tercihleri" settings section that controlled it was deleted from `ayarlar/page.tsx` (see below).

`purchase-orders-client.tsx`'s tab set changed from `orders | replenishment | scorecard | quotes` to `orders | pending_approvals | scorecard | quotes`. The "Siparişler" tab now excludes `pending_approval`-status orders by default (`excludeStatus` on the query when no explicit status filter is set) since they have their own dedicated tab/status filter now.

## İkmal Önerileri (replenishment) — removed entirely

The reorder-suggestion feature described earlier in this file no longer exists:
- Backend: `ReplenishmentController.php` deleted, its two routes (`/replenishment/suggestions`, `/replenishment/orders`) removed from `routes/api.php`.
- Frontend: `replenishment-panel.tsx` and `replenishment-order-dialog.tsx` deleted; `purchase-orders-client.tsx` no longer imports them or the `getReplenishmentSuggestions`/`createPurchaseOrdersFromSuggestions` API functions (also removed from `lib/api/purchase-orders.ts`), and the "İkmal Önerileri" tab is gone from the Satın Alma command center. Tedarikçi Karnesi (scorecard) tab is unaffected.

## Ayarlar (Settings) — Bildirim Tercihleri section removed

The notification-preferences card (kritik stok / yeni sipariş / sistem güncellemeleri checkboxes) was deleted from `ayarlar/page.tsx` along with its `NOTIFICATION_ROWS` config. Notification behavior is no longer user-toggleable; see the app-header note above.

## Still-relevant context from before this round

- **Satın Alma command center** (`purchase-orders-client.tsx` + `purchase-command-hero.tsx`): full CRUD, receive-to-stock, cancel, delete, gated through `Can`/`useAuth`. Tabs are now Siparişler / Onay Bekleyen / Tedarikçi Karnesi / (quotes dialog, not a tab). `lib/purchase-order-actions.ts`'s `getAvailableActions` is still the single source of truth for which actions a PO status allows.
- **Command-hero pattern** (`components/common/command-hero.tsx`) is shared across Ürünler, Depolar, Stok Hareketleri, Tedarikçiler, and Satın Alma — each with its own thin wrapper component.
- `/stok/islem` combines giriş/çıkış/transfer in one page (`combined-movement-page.tsx`); `/stok/transfer` no longer exists standalone.
- `/takvim` (`components/calendar/calendar-client.tsx`) is a monthly calendar over stock movements and purchase orders. Not linked from `nav-config.ts` — check before assuming it's reachable from the sidebar.
- `PurchaseOrder.receivedAt` and `StockMovement.purchaseOrderId` are additive schema fields tying delivery timestamps and stock movements back to their originating PO.

## Untracked scratch files

`backend/check.php` and `backend/create_users.php` are untracked, ad-hoc scripts (not part of the app) — don't assume they're wired into anything; check their contents before relying on them.
