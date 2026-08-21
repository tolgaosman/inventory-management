"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAsync } from "@/lib/hooks/use-async";
import { useAuth } from "@/lib/auth";
import { getAppUser } from "@/lib/api/users";
import { listRoles } from "@/lib/api/roles";
import { listMovements } from "@/lib/api/movements";
import { listProducts } from "@/lib/api/products";
import { listWarehouses } from "@/lib/api/catalog";
import { listPurchaseOrders, type PurchaseOrderRow } from "@/lib/api/purchase-orders";
import { listQuoteRequests, type QuoteRequestRow } from "@/lib/api/quotes";
import { PageHeader } from "@/components/common/page-header";
import { Section, SectionStack } from "@/components/common/section";
import { StatGrid } from "@/components/common/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import {
  ArrowLeft,
  Mail,
  Phone,
  ShieldCheck,
  Warehouse,
  ShoppingCart,
  User,
  Activity,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { ROLE_LABELS, MOVEMENT_TYPE_LABELS, MOVEMENT_REASON_LABELS } from "@/lib/constants";
import { formatNumber, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Role, StockMovement } from "@/lib/types";

const MOVEMENT_TYPE_TONE: Record<StockMovement["type"], string> = {
  giris: "bg-status-good/10 text-status-good",
  cikis: "bg-status-critical/10 text-status-critical",
  transfer: "bg-tint-blue/15 text-tint-blue",
};

const ACTIVITY_PAGE_SIZE = 10;

const ROLE_STYLE: Partial<Record<Role, { bg: string; text: string; icon: React.ElementType }>> = {
  admin: { bg: "bg-tint-plum/15", text: "text-tint-plum", icon: ShieldCheck },
  depo_yonetici: { bg: "bg-tint-blue/15", text: "text-tint-blue", icon: ShieldCheck },
  satinalma_yonetici: { bg: "bg-tint-blue/15", text: "text-tint-blue", icon: ShieldCheck },
  depo: { bg: "bg-tint-teal/15", text: "text-tint-teal", icon: Warehouse },
  satinalma: { bg: "bg-tint-amber/15", text: "text-tint-amber", icon: ShoppingCart },
};
/** Any role outside the 5 built-ins (a custom role created on the Roller page) gets this. */
const ROLE_STYLE_DEFAULT = { bg: "bg-muted", text: "text-muted-foreground", icon: ShieldCheck };

function RoleBadge({ role, label }: { role: Role; label: string }) {
  const style = ROLE_STYLE[role] ?? ROLE_STYLE_DEFAULT;
  const Icon = style.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 border-0 font-semibold text-xs", style.bg, style.text)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

export function UserProfileClient({ id }: { id: string }) {
  const { role: currentUserRole } = useAuth();
  const { data: user, status, error } = useAsync(() => getAppUser(id), [id]);
  const { data: rolesData } = useAsync(
    () => (currentUserRole === "admin" ? listRoles() : Promise.resolve([])),
    [currentUserRole],
  );
  const roleLabel = (role: Role) => (rolesData ?? []).find((r) => r.id === role)?.name ?? ROLE_LABELS[role] ?? role;

  const [activityPage, setActivityPage] = useState(1);
  const [purchasePage, setPurchasePage] = useState(1);
  const [quotePage, setQuotePage] = useState(1);

  const { data: activity, status: activityStatus } = useAsync(
    () => listMovements({ userId: id, page: activityPage, pageSize: ACTIVITY_PAGE_SIZE }),
    [id, activityPage],
  );
  
  const { data: purchaseActivity, status: purchaseStatus } = useAsync(
    () => listPurchaseOrders({ createdBy: id, page: purchasePage, pageSize: ACTIVITY_PAGE_SIZE }),
    [id, purchasePage],
  );

  const { data: quoteActivity, status: quoteStatus } = useAsync(
    () => listQuoteRequests({ createdBy: id, page: quotePage, pageSize: ACTIVITY_PAGE_SIZE }),
    [id, quotePage],
  );
  const { data: productResult } = useAsync(() => listProducts({ pageSize: 2000 }), []);
  const { data: warehouses } = useAsync(() => listWarehouses(), []);
  const products = useMemo(() => productResult?.rows ?? [], [productResult]);

  const activityColumns = useMemo<ColumnDef<StockMovement, unknown>[]>(
    () => [
      {
        id: "type",
        header: "Tür",
        meta: { className: "w-[12%] text-left" },
        cell: ({ row }) => (
          <Badge variant="outline" className={cn("border-0 font-semibold text-xs", MOVEMENT_TYPE_TONE[row.original.type])}>
            {MOVEMENT_TYPE_LABELS[row.original.type]}
          </Badge>
        ),
      },
      {
        id: "product",
        header: "Ürün",
        meta: { className: "w-[30%] text-left" },
        cell: ({ row }) => {
          const product = products.find((p) => p.id === row.original.productId);
          return (
            <Link
              href={`/urunler/${row.original.productId}`}
              className="flex items-center gap-3 group hover:text-primary"
            >
              <ProductImageThumbnail src={product?.imageUrl} alt={product?.name ?? ""} size="sm" />
              <div className="min-w-0">
                <span className="block truncate font-medium text-foreground group-hover:text-primary transition-colors">
                  {product?.name ?? "Bilinmeyen ürün"}
                </span>
                <span className="block font-mono text-xs text-muted-foreground">{product?.sku}</span>
              </div>
            </Link>
          );
        },
      },
      {
        id: "warehouse",
        header: "Depo",
        meta: { className: "w-[18%] text-left" },
        cell: ({ row }) => {
          const name = warehouses?.find((w) => w.id === row.original.warehouseId)?.name ?? "-";
          return <span className="block truncate" title={name}>{name}</span>;
        },
      },
      {
        id: "quantity",
        header: "Miktar",
        meta: { className: "w-[10%] whitespace-nowrap text-right" },
        cell: ({ row }) => (
          <span
            className={cn(
              "font-medium tabular-nums",
              row.original.type === "cikis" ? "text-status-critical" : "text-status-good",
            )}
          >
            {row.original.type === "cikis" ? "-" : "+"}
            {formatNumber(row.original.quantity)}
          </span>
        ),
      },
      {
        id: "reason",
        header: "Sebep",
        meta: { className: "w-[20%] text-left" },
        cell: ({ row }) => (
          <span className="block truncate" title={MOVEMENT_REASON_LABELS[row.original.reason]}>
            {MOVEMENT_REASON_LABELS[row.original.reason]}
          </span>
        ),
      },
      {
        id: "createdAt",
        header: "Tarih",
        meta: { className: "w-[10%] whitespace-nowrap text-right" },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [products, warehouses],
  );

  const purchaseColumns = useMemo<ColumnDef<PurchaseOrderRow, unknown>[]>(
    () => [
      {
        id: "code",
        header: "Sipariş Kodu",
        meta: { className: "w-[20%] text-left" },
        cell: ({ row }) => (
          <Link href={`/satin-alma/${row.original.id}`} className="font-mono text-sm hover:text-primary transition-colors">
            {row.original.code}
          </Link>
        ),
      },
      {
        id: "supplier",
        header: "Tedarikçi",
        meta: { className: "w-[40%] text-left" },
        cell: ({ row }) => <span className="block truncate">{row.original.supplierName}</span>,
      },
      {
        id: "createdAt",
        header: "Oluşturulma",
        meta: { className: "w-[20%] whitespace-nowrap text-right" },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  const quoteColumns = useMemo<ColumnDef<QuoteRequestRow, unknown>[]>(
    () => [
      {
        id: "code",
        header: "Teklif Kodu",
        meta: { className: "w-[20%] text-left" },
        cell: ({ row }) => (
          <Link href={`/teklifler/${row.original.id}`} className="font-mono text-sm hover:text-primary transition-colors">
            {row.original.code}
          </Link>
        ),
      },
      {
        id: "supplier",
        header: "Tedarikçi",
        meta: { className: "w-[40%] text-left" },
        cell: ({ row }) => <span className="block truncate">{row.original.supplierName}</span>,
      },
      {
        id: "createdAt",
        header: "Oluşturulma",
        meta: { className: "w-[20%] whitespace-nowrap text-right" },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  if (status === "loading") {
    return <div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>;
  }

  if (status === "error" || !user) {
    return (
      <div className="p-8 text-center text-red-500">
        Personel bilgileri yüklenemedi. Yetkiniz olmayabilir veya kullanıcı silinmiş olabilir.
        <div className="mt-4">
          <Button render={<Link href="/kullanicilar" />} nativeButton={false} variant="outline">
            <ArrowLeft className="size-4 mr-2" />
            Geri Dön
          </Button>
        </div>
      </div>
    );
  }

  const roleStyle = ROLE_STYLE[user.role] ?? ROLE_STYLE_DEFAULT;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personel Profili"
        description="Sistem kullanıcısı detayları ve aktivite özeti."
        actions={
          <Button render={<Link href="/kullanicilar" />} nativeButton={false} variant="outline" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Kullanıcılara Dön
          </Button>
        }
      />

      <SectionStack>
        <Section index={0}>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div
                    className={cn(
                      "flex size-24 shrink-0 items-center justify-center rounded-full text-2xl font-bold",
                      roleStyle.bg,
                      roleStyle.text,
                    )}
                  >
                    {user.initials}
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold tracking-tight text-foreground">{user.name}</h2>
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
                      <Mail className="size-3.5" />
                      {user.email}
                    </p>
                    {user.phone && (
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
                        <Phone className="size-3.5" />
                        {user.phone}
                      </p>
                    )}
                  </div>
                  <RoleBadge role={user.role} label={roleLabel(user.role)} />
                </div>
              </CardContent>
            </Card>

            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="size-4 text-primary" />
                    Sistem Aktiviteleri
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Warehouse roles: breakdown of stock movement types */}
                  {(["depo", "depo_yonetici", "admin"] as string[]).some((r) => r === user.role) && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stok Hareketleri</p>
                      <StatGrid
                        className="grid-cols-3 gap-3"
                        items={[
                          {
                            icon: ArrowDownToLine,
                            tint: "green",
                            label: "Giriş",
                            value: user.stats?.movementsInCount?.toString() ?? "0",
                          },
                          {
                            icon: ArrowUpFromLine,
                            tint: "red",
                            label: "Çıkış",
                            value: user.stats?.movementsOutCount?.toString() ?? "0",
                          },
                          {
                            icon: ArrowLeftRight,
                            tint: "blue",
                            label: "Transfer",
                            value: user.stats?.movementsTransferCount?.toString() ?? "0",
                          },
                        ]}
                      />
                    </div>
                  )}

                  {/* Purchase roles: purchase orders + quote requests */}
                  {(["satinalma", "satinalma_yonetici", "admin"] as string[]).some((r) => r === user.role) && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Satın Alma İşlemleri</p>
                      <StatGrid
                        className="grid-cols-1 sm:grid-cols-2 gap-3"
                        items={[
                          {
                            icon: ShoppingCart,
                            tint: "amber",
                            label: "Oluşturulan Siparişler",
                            value: user.stats?.purchaseOrdersCount?.toString() ?? "0",
                          },
                          {
                            icon: FileText,
                            tint: "teal",
                            label: "Teklif Formları",
                            value: user.stats?.quoteRequestsCount?.toString() ?? "0",
                          },
                        ]}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="size-4 text-primary" />
                    Kayıt Bilgileri
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-sm">
                    <div className="space-y-1">
                      <dt className="text-muted-foreground font-medium">Kullanıcı ID</dt>
                      <dd className="font-mono text-foreground">#{user.id}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-muted-foreground font-medium">Durum</dt>
                      <dd className="text-foreground">
                        {user.deletedAt ? (
                          <span className="text-destructive font-medium">Silinmiş</span>
                        ) : (
                          <span className="text-emerald-500 font-medium">Aktif</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        </Section>

        <Section index={1}>
          <div className="space-y-10">
            {(["depo", "depo_yonetici", "admin"] as string[]).some((r) => r === user.role) && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <History className="size-4 text-primary" />
                  Stok Hareketleri Geçmişi
                </h2>
                <DataTable
                  columns={activityColumns}
                  data={activity?.rows ?? []}
                  total={activity?.total ?? 0}
                  page={activityPage}
                  pageSize={ACTIVITY_PAGE_SIZE}
                  onPageChange={setActivityPage}
                  loading={activityStatus === "loading"}
                  emptyTitle="Bu kullanıcıya ait stok hareketi yok"
                />
              </section>
            )}

            {(["satinalma", "satinalma_yonetici", "admin"] as string[]).some((r) => r === user.role) && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <section className="space-y-3">
                  <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                    <History className="size-4 text-primary" />
                    Oluşturulan Siparişler
                  </h2>
                  <DataTable
                    columns={purchaseColumns}
                    data={purchaseActivity?.rows ?? []}
                    total={purchaseActivity?.total ?? 0}
                    page={purchasePage}
                    pageSize={ACTIVITY_PAGE_SIZE}
                    onPageChange={setPurchasePage}
                    loading={purchaseStatus === "loading"}
                    emptyTitle="Bu kullanıcıya ait sipariş yok"
                  />
                </section>
                
                <section className="space-y-3">
                  <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                    <History className="size-4 text-primary" />
                    Oluşturulan Teklif Formları
                  </h2>
                  <DataTable
                    columns={quoteColumns}
                    data={quoteActivity?.rows ?? []}
                    total={quoteActivity?.total ?? 0}
                    page={quotePage}
                    pageSize={ACTIVITY_PAGE_SIZE}
                    onPageChange={setQuotePage}
                    loading={quoteStatus === "loading"}
                    emptyTitle="Bu kullanıcıya ait teklif formu yok"
                  />
                </section>
              </div>
            )}
          </div>
        </Section>
      </SectionStack>
    </div>
  );
}
