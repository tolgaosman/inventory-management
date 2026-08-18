"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  X,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { ForbiddenState } from "@/components/common/forbidden-state";
import { Section, SectionStack } from "@/components/common/section";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/data-table/data-table";
import { SupplierFormSheet } from "@/components/suppliers/supplier-form-sheet";
import { useAsync } from "@/lib/hooks/use-async";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency-context";
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier, type SupplierQuery } from "@/lib/api/catalog";
import { getSupplierScorecards, type SupplierScorecard } from "@/lib/api/purchase-orders";
import { performanceTextClass } from "@/lib/purchase-order-actions";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import type { Supplier } from "@/lib/types";
import { buildReportData } from "@/lib/export/report-data";
import { buildReportExcel } from "@/lib/export/excel";
import { buildReportPdf } from "@/lib/export/pdf";
import { downloadBlob, reportFilename } from "@/lib/export/download";
import { SupplierCommandHero } from "@/components/suppliers/supplier-command-hero";

type SupplierRow = Supplier & {
  productCount: number;
  scorecard?: SupplierScorecard;
};

export function SuppliersClient() {
  const router = useRouter();
  const { name, role } = useAuth();
  const { currency, rates } = useCurrency();
  const rate = rates?.[currency] || 1;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [noProductsOnly, setNoProductsOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | undefined>(undefined);
  const [deleting, setDeleting] = useState<SupplierRow | undefined>(undefined);

  const exportGuard = useSubmitGuard();

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query: SupplierQuery = useMemo(
    () => ({ search: search || undefined, page, pageSize: PAGE_SIZE }),
    [search, page],
  );

  const { status, data, staleData, error, refetch } = useAsync(() => listSuppliers(query), [
    JSON.stringify(query),
  ]);
  const { data: scorecards } = useAsync(getSupplierScorecards, []);

  const rawView = data ?? staleData;
  const view = useMemo(() => {
    if (!rawView) return rawView;
    const rows: SupplierRow[] = rawView.rows.map((s) => ({
      ...s,
      scorecard: scorecards?.find((sc) => sc.supplierId === s.id),
    }));
    return { ...rawView, rows: noProductsOnly ? rows.filter((s) => s.productCount === 0) : rows };
  }, [rawView, scorecards, noProductsOnly]);

  const summary = useMemo(() => {
    const rows = rawView?.rows ?? [];
    const totalProducts = rows.reduce((sum, s) => sum + s.productCount, 0);
    const cityCount = new Set(rows.map((s) => s.city)).size;
    return { totalCount: rawView?.total ?? 0, totalProducts, cityCount };
  }, [rawView]);

  const heroStats = useMemo(() => {
    if (!scorecards || !rawView) return undefined;
    const withOnTime = scorecards.filter((s) => s.onTimeRatePercent !== null);
    const avgOnTimePercent =
      withOnTime.length > 0
        ? Math.round(withOnTime.reduce((sum, s) => sum + (s.onTimeRatePercent ?? 0), 0) / withOnTime.length)
        : null;
    return {
      totalCount: summary.totalCount,
      totalProducts: summary.totalProducts,
      cityCount: summary.cityCount,
      totalOpenValue: scorecards.reduce((sum, s) => sum + s.openValue, 0),
      avgOnTimePercent,
      riskyCount: scorecards.filter((s) => s.onTimeRatePercent !== null && s.onTimeRatePercent < 60).length,
      noProductsCount: scorecards.filter((s) => s.productCount === 0).length,
    };
  }, [scorecards, rawView, summary]);

  const isFiltered = Boolean(search) || noProductsOnly;

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setNoProductsOnly(false);
  }

  async function handleExport(type: "excel" | "pdf") {
    await exportGuard.guard(async () => {
      try {
        const report = buildReportData("bu-yil", `${name} (${role})`, currency, rates?.[currency]);
        const date = new Date();
        if (type === "excel") {
          downloadBlob(buildReportExcel(report, ["suppliers"]), reportFilename("xlsx", date, "tedarikci-raporu"));
          toast.success("Excel raporu indirildi");
        } else {
          downloadBlob(await buildReportPdf(report, ["suppliers"]), reportFilename("pdf", date, "tedarikci-raporu"));
          toast.success("PDF raporu indirildi");
        }
      } catch {
        toast.error(type === "excel" ? "Excel oluşturulamadı" : "PDF oluşturulamadı");
      }
    });
  }

  async function handleSaved(values: Omit<Supplier, "id">) {
    try {
      if (editing) {
        await updateSupplier(editing.id, values);
      } else {
        await createSupplier(values);
      }
      refetch();
    } catch (err) {
      toast.error(editing ? "Tedarikçi güncellenemedi" : "Tedarikçi oluşturulamadı", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      throw err;
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteSupplier(deleting.id);
      toast.success("Tedarikçi silindi.", { description: `${deleting.name} kaldırıldı.` });
      setDeleting(undefined);
      refetch();
    } catch (err) {
      toast.error("Tedarikçi silinemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  const columns = useMemo<ColumnDef<SupplierRow, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Tedarikçi",
        meta: { className: "w-[16%] text-left" },
        cell: ({ row }) => (
          <Link
            href={`/tedarikciler/${row.original.id}`}
            className="block truncate font-medium text-foreground hover:text-primary transition-colors"
            title={row.original.name}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "contactName",
        accessorKey: "contactName",
        header: "Yetkili",
        meta: { className: "w-[12%] text-center" },
        cell: ({ row }) => (
          <span className="block truncate text-center" title={row.original.contactName}>{row.original.contactName}</span>
        ),
      },
      {
        id: "email",
        accessorKey: "email",
        header: "E-posta",
        meta: { className: "w-[15%] text-center" },
        cell: ({ row }) => (
          <span className="block truncate text-center" title={row.original.email}>{row.original.email}</span>
        ),
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: "Telefon",
        meta: { className: "w-[11%] text-center" },
        cell: ({ row }) => (
          <span className="block truncate text-center" title={row.original.phone}>{row.original.phone}</span>
        ),
      },
      {
        id: "city",
        accessorKey: "city",
        header: "Şehir",
        meta: { className: "w-[10%] text-center" },
        cell: ({ row }) => (
          <span className="block truncate text-center" title={row.original.city}>{row.original.city}</span>
        ),
      },
      {
        id: "productCount",
        accessorKey: "productCount",
        header: "Ürün Sayısı",
        meta: { className: "w-[9%] text-center" },
        cell: ({ row }) => <span className="tabular-nums flex justify-center">{formatNumber(row.original.productCount)}</span>,
      },
      {
        id: "openValue",
        header: "Açık Sipariş",
        meta: { className: "w-[11%] text-center" },
        cell: ({ row }) => {
          const sc = row.original.scorecard;
          if (!sc || sc.openValue === 0) return <span className="block text-center text-sm text-muted-foreground">—</span>;
          return (
            <span className="block text-center tabular-nums font-medium text-foreground">
              {formatCurrency(sc.openValue / rate, currency, 1, true)}
            </span>
          );
        },
      },
      {
        id: "onTimeRate",
        header: "Zamanında Teslimat",
        meta: { className: "w-[11%] text-center" },
        cell: ({ row }) => {
          const percent = row.original.scorecard?.onTimeRatePercent ?? null;
          if (percent === null) return <span className="block text-center text-sm text-muted-foreground">—</span>;
          return <span className={cn("block text-center tabular-nums font-semibold", performanceTextClass(percent))}>%{percent}</span>;
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { className: "w-16 pr-5 text-right" },
        cell: ({ row }) => {
          const supplier = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<Link href={`/tedarikciler/${supplier.id}`} />}>
                  <Eye className="size-4" />
                  Detay Göster
                </DropdownMenuItem>
                <Can permission="suppliers.manage">
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(supplier);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      Düzenle
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(supplier)}>
                      <Trash2 className="size-4" />
                      Sil
                    </DropdownMenuItem>
                  </>
                </Can>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [rate, currency],
  );

  return (
    <Can permission="suppliers.view" fallback={<Forbidden />}>
      <div className="space-y-6">
        <PageHeader
          title="Tedarikçi Yönetimi"
          description="Ürünlerinizi tedarik ettiğiniz firmalar ve iletişim bilgileri."
          actions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={exportGuard.pending}>
                      {exportGuard.pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                      Dışa Aktar
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("excel")}>
                    <FileSpreadsheet className="size-4 text-status-good" /> Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")}>
                    <FileText className="size-4 text-status-critical" /> PDF (.pdf)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Can permission="suppliers.manage">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(undefined);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Yeni Tedarikçi
                </Button>
              </Can>
            </>
          }
        />

        <SupplierCommandHero
          stats={heroStats}
          currency={currency}
          rate={rate}
          onOverviewClick={clearFilters}
          onRiskyClick={() => router.push("/satin-alma?tab=scorecard")}
          onNoProductsClick={() => setNoProductsOnly((v) => !v)}
        />

        <SectionStack className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Section index={0}>
            <Card>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Tedarikçi adı, yetkili, e-posta veya şehir ara…"
                      className="h-9 pl-8"
                    />
                  </div>
                  {isFiltered && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
                      <X className="size-4" />
                      Temizle
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </Section>

          <Section index={2}>
            <DataTable
              columns={columns}
              data={view?.rows ?? []}
              total={noProductsOnly ? view?.rows.length ?? 0 : view?.total ?? 0}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              loading={!view}
              error={status === "error" && !view ? error : undefined}
              onRetry={refetch}
              isFiltered={isFiltered}
              emptyTitle="Henüz tedarikçi yok"
              emptyDescription="Sisteme henüz bir tedarikçi eklenmemiş."
            />
          </Section>
        </SectionStack>

        <SupplierFormSheet open={formOpen} onOpenChange={setFormOpen} supplier={editing} onSaved={handleSaved} />

        <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tedarikçiyi sil</AlertDialogTitle>
              <AlertDialogDescription>
                {deleting
                  ? `"${deleting.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz. Bu tedarikçiye bağlı ürünler varsa silme işlemi engellenecektir.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction variant="destructive-solid" onClick={handleDelete}>
                Sil
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Can>
  );
}

function Forbidden() {
  return (
    <div className="space-y-6">
      <PageHeader title="Tedarikçi Yönetimi" />
      <ForbiddenState message="Tedarikçileri görüntülemek için yetkiniz yok." />
    </div>
  );
}
