import Link from "next/link";
import { ArrowUpRight, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MovementTypeBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { relativeTimeFromNow, formatSigned } from "@/lib/format";
import type { EnrichedMovement } from "@/lib/mock/dashboard";

export function RecentMovementsTable({ items }: { items: EnrichedMovement[] }) {
  const [featured, ...rest] = items;

  return (
    <Card className="flex h-full flex-col py-5">
      <CardHeader className="flex-row items-center justify-between px-5 pb-2">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">Son Stok Hareketleri</CardTitle>
        <Link
          href="/stok/hareketler"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Tümünü gör
          <ArrowUpRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 px-5">
        {items.length === 0 ? (
          <EmptyState icon={History} title="Henüz stok hareketi yok" />
        ) : (
          <div className="flex h-full flex-col gap-3">
            {/*
              Featured — the single most recent movement. Deliberately not a
              nested card: the outer Card already declares the surface, so this
              block leans on spacing and one hairline instead of stacking three
              boxed containers inside each other.
            */}
            <div className="shrink-0 border-b border-border pb-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-micro text-muted-foreground">{featured.id}</span>
                <MovementTypeBadge type={featured.type} />
              </div>
              <div className="flex items-center gap-3">
                <ProductImageThumbnail src={featured.productImageUrl} alt={featured.productName} size="lg" />
                <div className="min-w-0 flex-1">
                  <Link href={`/urunler/${featured.productId}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
                    {featured.productName}
                  </Link>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {formatSigned(featured.type === "cikis" ? -featured.quantity : featured.quantity)}
                  </span>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div className="min-w-0">
                  <dt className="text-micro text-muted-foreground">Depo</dt>
                  <dd className="truncate text-xs font-medium text-foreground">{featured.warehouseName}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-micro text-muted-foreground">Kullanıcı</dt>
                  <dd className="truncate text-xs font-medium text-foreground">{featured.userName}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-micro text-muted-foreground">Stok</dt>
                  <dd className="text-xs font-medium tabular-nums text-foreground">
                    {featured.previousQuantity} → {featured.newQuantity}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-micro text-muted-foreground">Zaman</dt>
                  <dd className="text-xs font-medium text-foreground">{relativeTimeFromNow(featured.createdAt)}</dd>
                </div>
              </dl>
            </div>

            {/* Rest — compact rows, no data left behind */}
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto custom-scrollbar">
              {rest.map((m) => {
                const signedQty = m.type === "cikis" ? -m.quantity : m.quantity;
                return (
                  <Link
                    key={m.id}
                    href={`/urunler/${m.productId}`}
                    className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/60"
                  >
                    <ProductImageThumbnail src={m.productImageUrl} alt={m.productName} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{m.productName}</p>
                      <p className="truncate text-micro text-muted-foreground">{relativeTimeFromNow(m.createdAt)}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                      {formatSigned(signedQty)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
