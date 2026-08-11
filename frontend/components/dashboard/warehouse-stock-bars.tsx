import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import type { WarehouseStockTotal } from "@/lib/mock/dashboard";
import { EmptyState } from "@/components/common/empty-state";
import { Warehouse } from "lucide-react";

export function WarehouseStockBars({ data }: { data: WarehouseStockTotal[] }) {
  return (
    <Card className="shadow-soft border-border/70 flex flex-col justify-between py-5 min-h-[360px]">
      <CardHeader className="px-5 pb-2">
        <CardTitle className="text-base font-bold tracking-tight text-foreground flex items-center justify-between">
          <span>Depo Bazında Stok</span>
          <span className="text-xs font-normal text-muted-foreground">{data.length} depo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 flex-1 min-h-0">
        {data.length === 0 ? (
          <EmptyState icon={Warehouse} title="Depo verisi yok" />
        ) : (
          <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/70 hover:bg-transparent">
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Depo Adı</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Toplam Stok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((w) => (
                  <TableRow key={w.warehouseId} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <TableCell className="py-2.5 px-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Warehouse className="size-3.5" />
                        </div>
                        <span className="font-semibold text-foreground text-xs sm:text-sm truncate">{w.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-2.5 px-2">
                      <span className="text-xs font-bold text-foreground bg-muted/70 px-2.5 py-1 rounded-md inline-block">
                        {formatNumber(w.units)} adet
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


