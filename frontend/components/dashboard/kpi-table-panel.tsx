import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TINTS } from "@/lib/tints";

export interface KpiTableItem {
  icon: LucideIcon;
  tint?: keyof typeof TINTS;
  label: string;
  value: string;
}

export function KpiTablePanel({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon?: LucideIcon;
  items: KpiTableItem[];
}) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pt-1">
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60 bg-muted/40 hover:bg-muted/40">
                <TableHead className="py-2 px-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Metrik
                </TableHead>
                <TableHead className="py-2 px-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Miktar / Değer
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => {
                const ItemIcon = item.icon;
                const tintKey = item.tint || "blue";
                return (
                  <TableRow
                    key={item.label}
                    className={cn(
                      "hover:bg-muted/40 transition-colors",
                      idx !== items.length - 1 && "border-b border-border/50"
                    )}
                  >
                    <TableCell className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-md",
                            TINTS[tintKey]
                          )}
                        >
                          <ItemIcon className="size-3.5" />
                        </div>
                        <span className="truncate text-xs sm:text-sm font-medium text-foreground">
                          {item.label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 px-3.5 text-right">
                      <span className="text-xs sm:text-sm font-semibold tabular-nums text-foreground">
                        {item.value}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
