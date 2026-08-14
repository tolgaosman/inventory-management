"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Truck, Package, MapPin, Search, Plus, MoreHorizontal, Eye, Pencil, Trash2, X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { ForbiddenState } from "@/components/common/forbidden-state";
import { StatGrid } from "@/components/common/stat-card";
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
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier, type SupplierQuery } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";
import type { Supplier } from "@/lib/types";

type SupplierRow = Supplier & { productCount: number };

export function SuppliersClient() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | undefined>(undefined);
  const [deleting, setDeleting] = useState<SupplierRow | undefined>(undefined);

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
  const view = data ?? staleData;

  const isFiltered = Boolean(search);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
  }

  const summary = useMemo(() => {
    const rows = view?.rows ?? [];
    const totalProducts = rows.reduce((sum, s) => sum + s.productCount, 0);
    const cityCount = new Set(rows.map((s) => s.city)).size;
    return { totalCount: view?.total ?? 0, totalProducts, cityCount };
  }, [view]);

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
        meta: { className: "w-[22%]" },
        cell: ({ row }) => (
          <Link href={`/tedarikciler/${row.original.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "contactName",
        accessorKey: "contactName",
        header: "Yetkili",
        meta: { className: "w-[15%]" },
      },
      {
        id: "email",
        accessorKey: "email",
        header: "E-posta",
        meta: { className: "w-[20%]" },
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: "Telefon",
        meta: { className: "w-[15%]" },
      },
      {
        id: "city",
        accessorKey: "city",
        header: "Şehir",
        meta: { className: "w-[15%]" },
      },
      {
        id: "productCount",
        accessorKey: "productCount",
        header: "Ürün Sayısı",
        meta: { className: "w-[13%] text-right" },
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.productCount)}</span>,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { className: "w-12 text-right" },
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
    [],
  );

  return (
    <Can permission="suppliers.view" fallback={<Forbidden />}>
      <div className="space-y-6">
        <PageHeader
          title="Tedarikçi Yönetimi"
          description="Ürünlerinizi tedarik ettiğiniz firmalar ve iletişim bilgileri."
          actions={
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
          }
        />

        <SectionStack className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Section index={0}>
            <StatGrid
              className="grid-cols-1 gap-4 sm:grid-cols-3"
              items={[
                { icon: Truck, tint: "plum", label: "Toplam Tedarikçi", value: formatNumber(summary.totalCount) },
                { icon: Package, tint: "blue", label: "Toplam Ürün Çeşidi", value: formatNumber(summary.totalProducts) },
                { icon: MapPin, tint: "teal", label: "Şehir Sayısı", value: formatNumber(summary.cityCount) },
              ]}
            />
          </Section>

          <Section index={1}>
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
                      Filtreleri Temizle
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
              total={view?.total ?? 0}
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
