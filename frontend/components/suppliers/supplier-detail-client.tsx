"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Package, Mail, Phone, MapPin, User, MoreHorizontal, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { Can } from "@/components/common/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { SupplierFormSheet } from "@/components/suppliers/supplier-form-sheet";
import { useAsync } from "@/lib/hooks/use-async";
import { getSupplier, updateSupplier, deleteSupplier } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import type { Supplier } from "@/lib/types";

export function SupplierDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { status, data, staleData, error, refetch } = useAsync(() => getSupplier(id), [id]);
  const view = data ?? staleData;

  async function handleSaved(values: Omit<Supplier, "id">) {
    try {
      await updateSupplier(id, values);
      refetch();
    } catch (err) {
      toast.error("Tedarikçi güncellenemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      throw err;
    }
  }

  async function handleDelete() {
    try {
      await deleteSupplier(id);
      toast.success("Tedarikçi silindi.");
      router.push("/tedarikciler");
    } catch (err) {
      toast.error("Tedarikçi silinemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      setDeleting(false);
    }
  }

  if (status === "error" && !view) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tedarikçi Detayı" />
        <ErrorState message={error?.message} onRetry={refetch} />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl lg:col-span-1" />
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  const { supplier, products } = view;

  const fields: { icon: typeof User; label: string; value: React.ReactNode }[] = [
    { icon: User, label: "Yetkili", value: supplier.contactName },
    { icon: Mail, label: "E-posta", value: supplier.email },
    { icon: Phone, label: "Telefon", value: supplier.phone },
    { icon: MapPin, label: "Şehir", value: supplier.city },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tedarikciler"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Tedarikçilere dön
        </Link>
        <PageHeader
          title={supplier.name}
          description={`${supplier.contactName} · ${supplier.city}`}
          actions={
            <Can permission="suppliers.manage">
              <>
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Pencil className="size-4" />
                  Düzenle
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline" size="icon" className="size-9">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                      <Trash2 className="size-4" />
                      Sil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            </Can>
          }
        />
      </div>

      <div className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Package className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ürün Çeşidi</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatNumber(products.length)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Şehir</p>
                <p className="text-lg font-semibold text-foreground">{supplier.city}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="py-5 gap-3 lg:col-span-1">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                <User className="size-4 text-muted-foreground" />
                İletişim Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pt-2">
              <dl className="divide-y divide-border/60">
                {fields.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
                    <dd className="min-w-0 truncate text-right font-medium text-foreground" title={typeof f.value === "string" ? f.value : undefined}>
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card className="py-5 gap-3 lg:col-span-2">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                <Package className="size-4 text-muted-foreground" />
                Bu Tedarikçiden Alınan Ürünler
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pt-2">
              {products.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Bu tedarikçiden henüz ürün alınmamış.</p>
              ) : (
                <div className="max-h-96 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                  {products.map((p) => (
                    <Link
                      key={p.id}
                      href={`/urunler/${p.id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/50"
                    >
                      <ProductImageThumbnail src={p.imageUrl} alt={p.name} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{p.sku}</span> · {p.brand}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SupplierFormSheet open={formOpen} onOpenChange={setFormOpen} supplier={supplier} onSaved={handleSaved} />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tedarikçiyi sil</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${supplier.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz. Bu tedarikçiye bağlı ürünler varsa silme işlemi engellenecektir.`}
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
  );
}
