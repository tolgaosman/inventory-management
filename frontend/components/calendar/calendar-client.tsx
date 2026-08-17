"use client";

import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, isSameDay, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, ShoppingCart, Calendar as CalendarIcon } from "lucide-react";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAsync } from "@/lib/hooks/use-async";
import { listMovements } from "@/lib/api/movements";
import { listPurchaseOrders } from "@/lib/api/purchase-orders";
import { listProducts } from "@/lib/api/products";
import { listWarehouses } from "@/lib/api/catalog";
import type { StockMovement, PurchaseOrderStatus } from "@/lib/types";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/lib/format";
import { useCurrency } from "@/lib/currency-context";
import { useSettings } from "@/lib/settings-context";


const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const FILTER_LABELS: Record<string, string> = {
  all: "Tüm İşlemler",
  satin_alma: "Satın Alımlar",
  giris: "Stok Girişleri",
  cikis: "Stok Çıkışları",
  transfer: "Transferler",
};

export function CalendarClient() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const { currency, rates } = useCurrency();
  const { showKurus } = useSettings();

  // Fetch data
  const { data: movementsData } = useAsync(() => listMovements({ pageSize: 2000 }), []);
  const { data: purchasesData } = useAsync(() => listPurchaseOrders({ pageSize: 2000 }), []);
  const { data: productsData } = useAsync(() => listProducts({ pageSize: 2000 }), []);
  const { data: warehousesData } = useAsync(() => listWarehouses(), []);

  const movements = movementsData?.rows ?? [];
  const purchases = purchasesData?.rows ?? [];
  const products = productsData && 'rows' in productsData ? productsData.rows : [];
  const warehouses = warehousesData ?? [];

  const getProductName = (id: string) => products.find((p: any) => p.id === id)?.name ?? "Bilinmeyen Ürün";
  const getWarehouseName = (id?: string) => warehouses.find((w) => w.id === id)?.name ?? "-";

  // Grid calculation
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const paddingStart = useMemo(() => {
    const start = startOfMonth(currentDate).getDay();
    // JS getDay() is 0=Sun, 1=Mon. We want 0=Mon, 6=Sun.
    return start === 0 ? 6 : start - 1;
  }, [currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Filter events for a specific date based on selected filter
  const getEventsForDate = (date: Date) => {
    let dayMovements = movements.filter((m) => isSameDay(parseISO(m.createdAt), date));
    let dayPurchases = purchases.filter((p) => isSameDay(parseISO(p.createdAt), date));
    
    if (filterType !== "all") {
      if (filterType === "satin_alma") {
        dayMovements = [];
      } else {
        dayPurchases = [];
        dayMovements = dayMovements.filter(m => m.type === filterType);
      }
    }
    
    return { dayMovements, dayPurchases };
  };

  // Dialog Data
  const { dayMovements: selectedMovements, dayPurchases: selectedPurchases } = useMemo(() => {
    if (!selectedDate) return { dayMovements: [], dayPurchases: [] };
    return getEventsForDate(selectedDate);
  }, [selectedDate, movements, purchases, filterType]);

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col gap-3 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Takvim</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground">Stok hareketleri ve siparişlerin günlük takibi</p>
            <div className="flex items-center gap-1.5 border-l border-border/50 pl-3">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-1.5 py-0.5 rounded-md" title="Satın Alma Siparişleri">
                <ShoppingCart className="size-3" /> Sipariş
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-md" title="Stok Girişleri">
                <ArrowDownToLine className="size-3" /> Giriş
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded-md" title="Stok Çıkışları">
                <ArrowUpFromLine className="size-3" /> Çıkış
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-md" title="Transferler">
                <ArrowRightLeft className="size-3" /> Transfer
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterType} onValueChange={(val) => setFilterType(val || "all")}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue>{FILTER_LABELS[filterType]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm İşlemler</SelectItem>
              <SelectItem value="satin_alma">Satın Alımlar</SelectItem>
              <SelectItem value="giris">Stok Girişleri</SelectItem>
              <SelectItem value="cikis">Stok Çıkışları</SelectItem>
              <SelectItem value="transfer">Transferler</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 bg-card p-1 rounded-lg border border-border/50 shadow-sm">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="w-[140px] text-center font-semibold text-foreground">
            {format(currentDate, "MMMM yyyy", { locale: tr })}
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <ChevronRight className="size-4" />
          </Button>
          </div>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm border-border/50 [--card-spacing:--spacing(2)]">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          <div className="grid grid-cols-7 gap-1.5 auto-rows-fr h-full">
            {Array.from({ length: paddingStart }).map((_, i) => (
              <div key={`pad-${i}`} className="rounded-xl border border-transparent bg-transparent" />
            ))}
            
            {daysInMonth.map((date, i) => {
              const { dayMovements, dayPurchases } = getEventsForDate(date);
              const isCurrentDay = isToday(date);
              const totalEvents = dayMovements.length + dayPurchases.length;
              
              const ins = dayMovements.filter(m => m.type === "giris").length;
              const outs = dayMovements.filter(m => m.type === "cikis").length;
              const transfers = dayMovements.filter(m => m.type === "transfer").length;
              const buys = dayPurchases.length;

              const chips = [
                buys > 0 && {
                  key: "buys",
                  icon: ShoppingCart,
                  count: buys,
                  title: `${buys} Sipariş`,
                  cls: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10",
                },
                ins > 0 && {
                  key: "ins",
                  icon: ArrowDownToLine,
                  count: ins,
                  title: `${ins} Giriş`,
                  cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
                },
                outs > 0 && {
                  key: "outs",
                  icon: ArrowUpFromLine,
                  count: outs,
                  title: `${outs} Çıkış`,
                  cls: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10",
                },
                transfers > 0 && {
                  key: "transfers",
                  icon: ArrowRightLeft,
                  count: transfers,
                  title: `${transfers} Transfer`,
                  cls: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
                },
              ].filter((c): c is { key: string; icon: typeof ShoppingCart; count: number; title: string; cls: string } => Boolean(c));

              return (
                <div
                  key={date.toISOString()}
                  onClick={() => totalEvents > 0 ? setSelectedDate(date) : null}
                  className={cn(
                    "relative flex flex-col rounded-xl border p-2 min-h-[64px] transition-all",
                    isCurrentDay ? "border-primary/50 bg-primary/[0.02]" : "border-border/50 bg-card",
                    totalEvents > 0 ? "hover:border-primary/50 hover:shadow-md cursor-pointer" : "opacity-80"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "flex size-7 items-center justify-center rounded-full text-sm font-medium",
                      isCurrentDay ? "bg-primary text-primary-foreground" : "text-foreground"
                    )}>
                      {format(date, "d")}
                    </span>
                    {totalEvents > 0 && (
                      <span className="text-micro font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                        {totalEvents} işlem
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5 flex-1 min-h-0 content-end">
                    {chips.map(({ key, icon: Icon, count, title, cls }) => (
                      <div 
                        key={key} 
                        title={title}
                        className={cn("flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-semibold", cls)}
                      >
                        <Icon className="size-3" />
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="size-5 text-primary" />
              {selectedDate && format(selectedDate, "d MMMM yyyy, EEEE", { locale: tr })} İşlemleri
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            
            {/* Purchase Orders */}
            {selectedPurchases.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShoppingCart className="size-4 text-purple-500" />
                  Satın Alma Siparişleri ({selectedPurchases.length})
                </h3>
                <div className="grid gap-3">
                  {selectedPurchases.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                      <div>
                        <div className="font-medium text-sm text-foreground">{p.code}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{p.supplierName} • {p.itemCount} ürün</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">{formatCurrency(p.total, currency, rates?.[currency] || 1, showKurus)}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{p.status === "received" ? "Teslim Alındı" : p.status === "cancelled" ? "İptal Edildi" : "Bekliyor"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stock Movements */}
            {selectedMovements.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ArrowRightLeft className="size-4 text-blue-500" />
                  Stok Hareketleri ({selectedMovements.length})
                </h3>
                <div className="grid gap-3">
                  {selectedMovements.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "mt-0.5 p-1.5 rounded-md",
                          m.type === "giris" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                          m.type === "cikis" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" :
                          "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                        )}>
                          {m.type === "giris" ? <ArrowDownToLine className="size-3.5" /> : m.type === "cikis" ? <ArrowUpFromLine className="size-3.5" /> : <ArrowRightLeft className="size-3.5" />}
                        </div>
                        <div>
                          <div className="font-medium text-sm text-foreground">{getProductName(m.productId)}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                            <div>Miktar: <span className="font-medium text-foreground">{m.quantity}</span> • Sebep: {m.reason}</div>
                            {m.type === "giris" && <div>Depo: <span className="font-medium">{getWarehouseName(m.warehouseId)}</span></div>}
                            {m.type === "cikis" && <div>Depo: <span className="font-medium">{getWarehouseName(m.warehouseId)}</span></div>}
                            {m.type === "transfer" && <div>Transfer: <span className="font-medium">{getWarehouseName(m.warehouseId)}</span> ➔ <span className="font-medium">{getWarehouseName(m.targetWarehouseId)}</span></div>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {format(parseISO(m.createdAt), "HH:mm")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
