"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FolderTree,
  Folder,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { CategoryFormSheet, type CategoryFormValues } from "@/components/categories/category-form-sheet";
import { useAsync } from "@/lib/hooks/use-async";
import { useCurrency } from "@/lib/currency-context";
import { ApiError } from "@/lib/api/client";
import {
  listCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryNode,
} from "@/lib/api/categories";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

/** Fixed metric column widths, shared by the header and every row. */
const COL_PRODUCTS = "w-20 shrink-0 text-right";
const COL_UNITS = "w-24 shrink-0 text-right";
const COL_VALUE = "w-32 shrink-0 text-right";
const COL_CRITICAL = "w-24 shrink-0 flex justify-end";

/** Right-aligned metric columns, shared by root and child rows. */
function MetricCells({ node, currency, rate }: { node: CategoryNode; currency: string; rate: number }) {
  return (
    <>
      <div className={cn(COL_PRODUCTS, "hidden tabular-nums sm:block")}>
        {node.productCount > 0 ? (
          <span className="text-foreground">{formatNumber(node.productCount)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      <div className={cn(COL_UNITS, "hidden tabular-nums md:block")}>
        {node.totalUnits > 0 ? (
          <span className="text-foreground">{formatNumber(node.totalUnits)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      <div className={cn(COL_VALUE, "hidden tabular-nums lg:block")}>
        {node.totalValue > 0 ? (
          <span className="text-foreground">{formatCurrency(node.totalValue, currency, rate)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      <div className={cn(COL_CRITICAL, "hidden xl:flex")}>
        {node.criticalCount > 0 ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="size-3" />
            {formatNumber(node.criticalCount)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </>
  );
}

function ActionsMenu({
  node,
  isRoot,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: CategoryNode;
  isRoot: boolean;
  onAddChild: (parentId: string) => void;
  onEdit: (node: CategoryNode) => void;
  onDelete: (node: CategoryNode) => void;
}) {
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
        <Can permission="products.manage">
          <>
            {isRoot ? (
              <DropdownMenuItem onClick={() => onAddChild(node.id)}>
                <Plus className="size-4" />
                Alt Kategori Ekle
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => onEdit(node)}>
              <Pencil className="size-4" />
              Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(node)}>
              <Trash2 className="size-4" />
              Sil
            </DropdownMenuItem>
          </>
        </Can>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CategoriesClient() {
  const { currency, rates } = useCurrency();
  const rate = rates?.[currency] || 1;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>(undefined);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CategoryNode | undefined>(undefined);

  // Debounce free-text search input, same as the products page.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { status, data, staleData, error, refetch } = useAsync(
    () => listCategoryTree({ search: search || undefined }),
    [search],
  );
  const view = data ?? staleData;
  const tree = view?.tree ?? [];
  const stats = view?.stats;

  // While searching every matching branch stays open, so the hits are visible
  // without the user having to expand anything.
  const isExpanded = (id: string) => Boolean(search) || expanded.has(id);
  const allOpen = tree.length > 0 && tree.every((r) => isExpanded(r.id));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setExpanded(allOpen ? new Set() : new Set(tree.map((r) => r.id)));
  }

  function openCreate(parentId: string | null) {
    setEditing(undefined);
    setDefaultParentId(parentId);
    setFormOpen(true);
  }

  function openEdit(node: CategoryNode) {
    setEditing(node);
    setDefaultParentId(null);
    setFormOpen(true);
  }

  async function handleSaved(values: CategoryFormValues) {
    try {
      if (editing) {
        await updateCategory(editing.id, values);
      } else {
        await createCategory(values);
        // A brand-new child should be visible right away.
        if (values.parentId) setExpanded((prev) => new Set(prev).add(values.parentId!));
      }
      refetch();
    } catch (err) {
      toast.error(editing ? "Kategori güncellenemedi" : "Kategori oluşturulamadı", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      throw err;
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteCategory(deleting.id);
      toast.success("Kategori silindi.", { description: `${deleting.name} kategori ağacından kaldırıldı.` });
      setDeleting(undefined);
      refetch();
    } catch (err) {
      toast.error("Kategori silinemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kategori Yönetimi"
        description="Ürünleri üst ve alt kategorilere ayırın; stok dağılımını kategori bazında izleyin."
        actions={
          <Can permission="products.manage">
            <Button size="sm" onClick={() => openCreate(null)}>
              <Plus className="size-4" />
              Yeni Üst Kategori
            </Button>
          </Can>
        }
      />

      <div
        className={cn(
          "grid grid-cols-2 gap-4 lg:grid-cols-4",
          status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity",
        )}
      >
        <Card className="py-5 gap-2">
          <CardContent className="px-5">
            <KpiTile icon={Layers} tint="blue" label="Toplam Kategori" value={formatNumber(stats?.total ?? 0)} />
          </CardContent>
        </Card>
        <Card className="py-5 gap-2">
          <CardContent className="px-5">
            <KpiTile icon={FolderTree} tint="indigo" label="Üst Kategori" value={formatNumber(stats?.rootCount ?? 0)} />
          </CardContent>
        </Card>
        <Card className="py-5 gap-2">
          <CardContent className="px-5">
            <KpiTile icon={Tag} tint="teal" label="Alt Kategori" value={formatNumber(stats?.childCount ?? 0)} />
          </CardContent>
        </Card>
        <Card className="py-5 gap-2">
          <CardContent className="px-5">
            <KpiTile
              icon={AlertTriangle}
              tint="red"
              label="Kritik Stoklu Kategori"
              value={formatNumber(stats?.criticalCategoryCount ?? 0)}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="py-5 gap-3">
        <CardContent className="flex flex-wrap items-center gap-3 px-5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Kategori adı ara…"
              className="h-9 pl-8"
            />
          </div>
          {search ? (
            <Button variant="ghost" size="sm" onClick={() => setSearchInput("")} className="shrink-0">
              <X className="size-4" />
              Aramayı Temizle
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={toggleAll} className="shrink-0" disabled={!tree.length}>
              {allOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              {allOpen ? "Tümünü Kapat" : "Tümünü Aç"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0 gap-0">
        {/* Column headers — the metric widths here must match the row cells. */}
        <div className="flex items-center gap-3 border-b border-border/70 bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
          <div className="min-w-0 flex-1">Kategori</div>
          <div className={cn(COL_PRODUCTS, "hidden sm:block")}>Ürün</div>
          <div className={cn(COL_UNITS, "hidden md:block")}>Stok</div>
          <div className={cn(COL_VALUE, "hidden lg:block")}>Stok Değeri</div>
          <div className={cn(COL_CRITICAL, "hidden xl:flex")}>Kritik</div>
          <div className="w-8 shrink-0" />
        </div>

        {status === "error" && !view ? (
          <div className="p-4">
            <ErrorState message={error?.message} onRetry={refetch} />
          </div>
        ) : !view ? (
          <div className="divide-y divide-border/60">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4">
                <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                <div className="hidden h-4 w-20 animate-pulse rounded bg-muted sm:block" />
                <div className="hidden h-4 w-24 animate-pulse rounded bg-muted md:block" />
                <div className="hidden h-4 w-32 animate-pulse rounded bg-muted lg:block" />
              </div>
            ))}
          </div>
        ) : tree.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={FolderTree}
              title={search ? "Eşleşen kategori yok" : "Henüz kategori yok"}
              description={
                search
                  ? "Arama kriterine uyan bir kategori bulunamadı."
                  : "İlk üst kategoriyi oluşturarak ürünlerinizi gruplamaya başlayın."
              }
            />
          </div>
        ) : (
          <div
            className={cn(
              "divide-y divide-border/60",
              status === "loading" ? "opacity-50 transition-opacity" : "transition-opacity",
            )}
          >
            {tree.map((root) => {
              const open = isExpanded(root.id);
              return (
                <div key={root.id}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/30 transition-colors",
                      root.children.length > 0 && "cursor-pointer"
                    )}
                    onClick={() => root.children.length > 0 && toggle(root.id)}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(root.id);
                        }}
                        disabled={root.children.length === 0}
                        aria-expanded={open}
                        aria-label={open ? `${root.name} kategorisini kapat` : `${root.name} kategorisini aç`}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                      <FolderTree className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-semibold text-foreground">{root.name}</span>
                      {root.children.length > 0 ? (
                        <Badge variant="secondary" className="shrink-0 text-micro font-normal">
                          {root.children.length} alt kategori
                        </Badge>
                      ) : null}
                    </div>
                    <MetricCells node={root} currency={currency} rate={rate} />
                    <div className="w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu
                        node={root}
                        isRoot
                        onAddChild={openCreate}
                        onEdit={openEdit}
                        onDelete={setDeleting}
                      />
                    </div>
                  </div>

                  {open && root.children.length > 0 ? (
                    <div className="bg-muted/20">
                      {root.children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center gap-3 border-t border-border/40 px-4 py-2.5 text-sm hover:bg-muted/40"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2 pl-6">
                            <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                            <Folder className="size-4 shrink-0 text-muted-foreground" />
                            <Link
                              href={`/urunler?categoryId=${child.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="truncate font-medium text-foreground hover:text-primary hover:underline transition-colors cursor-pointer"
                              title={`${child.name} ürünlerini görüntüle`}
                            >
                              {child.name}
                            </Link>
                          </div>
                          <MetricCells node={child} currency={currency} rate={rate} />
                          <div className="w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <ActionsMenu
                              node={child}
                              isRoot={false}
                              onAddChild={openCreate}
                              onEdit={openEdit}
                              onDelete={setDeleting}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <CategoryFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
        defaultParentId={defaultParentId}
        allCategories={view?.all ?? []}
        onSaved={handleSaved}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategoriyi sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `"${deleting.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz.` +
                  (deleting.children.length > 0
                    ? ` Bu kategorinin ${deleting.children.length} alt kategorisi var; önce onları silmeniz gerekir.`
                    : deleting.productCount > 0
                      ? ` Bu kategoriye bağlı ${deleting.productCount} ürün var; silme işlemi engellenecektir.`
                      : "")
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
