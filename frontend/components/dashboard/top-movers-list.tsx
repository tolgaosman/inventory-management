import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { TopMover } from "@/lib/mock/dashboard";

export function TopMoversList({ items }: { items: TopMover[] }) {
  return (
    <Card className="shadow-soft border-border/70 flex flex-col justify-between py-5 min-h-[360px]">
      <CardHeader className="px-5 pb-2">
        <CardTitle className="text-base font-bold tracking-tight text-foreground">En Çok Hareket Gören Ürünler</CardTitle>
      </CardHeader>
      <CardContent className="px-5 flex-1 min-h-0">
        {items.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Hareket verisi yok" />
        ) : (
          <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/70 hover:bg-transparent">
                  <TableHead className="w-12 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">#</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ürün Adı</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Toplam İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={item.productId} className="border-b border-border/50 hover:bg-muted/50 transition-colors group cursor-pointer">
                    <TableCell className="text-center py-2.5 px-2">
                      <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 px-2 min-w-0">
                      <Link href={`/urunler/${item.productId}`} className="block truncate text-xs sm:text-sm font-semibold hover:underline text-foreground">
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right py-2.5 px-2">
                      <span className="text-xs font-bold text-foreground bg-muted/70 px-2.5 py-1 rounded-md inline-block">
                        {formatNumber(item.totalQuantity)} işlem
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


