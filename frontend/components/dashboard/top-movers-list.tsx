import Link from "next/link";
import { PanelCard } from "@/components/common/panel-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TopMover } from "@/lib/mock/dashboard";

import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";

/** Podium tones for the top 3 rows; everything past that stays neutral. */
const RANK_TONE = ["bg-tint-amber/15 text-tint-amber", "bg-tint-blue/12 text-tint-blue", "bg-tint-plum/12 text-tint-plum"];

export function TopMoversList({ items }: { items: TopMover[] }) {
  return (
    <PanelCard title="En Çok Hareket Gören Ürünler" className="min-h-[360px]">
      {items.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Hareket verisi yok" />
      ) : (
        <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="border-b border-border/70 hover:bg-transparent">
                <TableHead className="w-10 px-2 text-center">#</TableHead>
                <TableHead className="px-2">Ürün Adı</TableHead>
                <TableHead className="w-24 px-2 text-right">Toplam</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={item.productId} className="border-b border-border/50 hover:bg-muted/50 transition-colors group cursor-pointer">
                  <TableCell className="px-2 text-center">
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-md text-xs font-semibold transition-colors",
                        RANK_TONE[i] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                  </TableCell>
                  <TableCell className="px-2 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ProductImageThumbnail src={item.imageUrl} alt={item.name} size="xs" />
                      <Link href={`/urunler/${item.productId}`} className="block truncate text-xs sm:text-[13px] font-semibold hover:underline text-foreground">
                        {item.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 text-right">
                    <span className="text-xs font-semibold tabular-nums text-foreground bg-muted/70 px-2.5 py-1 rounded-md inline-block">
                      {formatNumber(item.totalQuantity)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PanelCard>
  );
}


