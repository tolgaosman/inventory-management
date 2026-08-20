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
import { ForbiddenState } from "@/components/common/forbidden-state";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatGrid } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Section, SectionStack } from "@/components/common/section";
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
import { useSettings } from "@/lib/settings-context";
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

/**
 * Per-breakpoint visibility for the metric columns, applied identically to the
 * header cell and its body cells so a hidden column never leaves a stray header.
 */
const COL_PRODUCTS = "hidden w-32 text-center sm:table-cell";
const COL_UNITS = "hidden w-36 text-center md:table-cell";
const COL_VALUE = "hidden w-48 text-center lg:table-cell";
const COL_CRITICAL = "hidden w-36 text-center xl:table-cell";

/** Center-aligned metric cells, shared by root and child rows. */
function MetricCells({
  node,
  currency,
  rate,
  showKurus,
}: {
  node: CategoryNode;
  currency: string;
  rate: number;
  showKurus: boolean;
}) {
  return (
    <>
      <TableCell className={cn(COL_PRODUCTS, "tabular-nums")}>
        {node.productCount > 0 ? (
          <span className="text-foreground">{formatNumber(node.productCount)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={cn(COL_UNITS, "tabular-nums")}>
        {node.totalUnits > 0 ? (
          <span className="text-foreground">{formatNumber(node.totalUnits)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={cn(COL_VALUE, "tabular-nums")}>
        {node.totalValue > 0 ? (
          <span className="text-foreground">{formatCurrency(node.totalValue, currency, rate, showKurus)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={COL_CRITICAL}>
        {node.criticalCount > 0 ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="size-3" />
            {formatNumber(node.criticalCount)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
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
    <Can permission="products.manage">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
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
        </DropdownMenuContent>
      </DropdownMenu>
    </Can>
  );
}

export function CategoriesClient() {
  const { currency, rates } = useCurrency();
  const { showKurus } = useSettings();
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
    <Can permission="products.view" fallback={<Forbidden />}>
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

      <SectionStack className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <Section index={0}>
      <StatGrid
        className="grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        items={[
          { icon: Layers, tint: "blue", label: "Toplam Kategori", value: formatNumber(stats?.total ?? 0) },
          { icon: FolderTree, tint: "plum", label: "Üst Kategori", value: formatNumber(stats?.rootCount ?? 0) },
          { icon: Tag, tint: "teal", label: "Alt Kategori", value: formatNumber(stats?.childCount ?? 0) },
          {
            icon: AlertTriangle,
            tint: "red",
            label: "Kritik Stoklu Kategori",
            value: formatNumber(stats?.criticalCategoryCount ?? 0),
          },
        ]}
      />
      </Section>

      <Section index={1}>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
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
      </Section>

      <Section index={2}>
      <Card className="overflow-hidden py-0 gap-0">
        {/*
          A real <Table> rather than a div grid: the tree is still a tree
          (rows expand, children indent), but the header, cell padding and hover
          treatment now come from the shared primitive instead of being
          hand-matched with fixed-width constants.
        */}
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/70 bg-muted/40 hover:bg-muted/40">
              <TableHead>Kategori</TableHead>
              <TableHead className={COL_PRODUCTS}>Ürün</TableHead>
              <TableHead className={COL_UNITS}>Stok</TableHead>
              <TableHead className={COL_VALUE}>Stok Değeri</TableHead>
              <TableHead className={COL_CRITICAL}>Kritik</TableHead>
              <TableHead className="w-16 pr-5 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody
            className={cn(status === "loading" && view ? "opacity-50 transition-opacity" : "transition-opacity")}
          >
            {status === "error" && !view ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-4">
                  <ErrorState message={error?.message} onRetry={refetch} />
                </TableCell>
              </TableRow>
            ) : !view ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/50">
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell className={COL_PRODUCTS}>
                    <Skeleton className="ml-auto h-4 w-10" />
                  </TableCell>
                  <TableCell className={COL_UNITS}>
                    <Skeleton className="ml-auto h-4 w-14" />
                  </TableCell>
                  <TableCell className={COL_VALUE}>
                    <Skeleton className="ml-auto h-4 w-20" />
                  </TableCell>
                  <TableCell className={COL_CRITICAL}>
                    <Skeleton className="ml-auto h-4 w-10" />
                  </TableCell>
                  <TableCell className="w-16 pr-5 text-right" />
                </TableRow>
              ))
            ) : tree.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-4">
                  <EmptyState
                    icon={FolderTree}
                    title={search ? "Eşleşen kategori yok" : "Henüz kategori yok"}
                    description={
                      search
                        ? "Arama kriterine uyan bir kategori bulunamadı."
                        : "İlk üst kategoriyi oluşturarak ürünlerinizi gruplamaya başlayın."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              tree.flatMap((root) => {
                const open = isExpanded(root.id);
                const rows = [
                  <TableRow
                    key={root.id}
                    className={cn(
                      "border-b border-border/50 transition-colors hover:bg-muted/50",
                      root.children.length > 0 && "cursor-pointer",
                    )}
                    onClick={() => root.children.length > 0 && toggle(root.id)}
                  >
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2">
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
                    </TableCell>
                    <MetricCells node={root} currency={currency} rate={rate} showKurus={showKurus} />
                    <TableCell className="w-16 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu
                        node={root}
                        isRoot
                        onAddChild={openCreate}
                        onEdit={openEdit}
                        onDelete={setDeleting}
                      />
                    </TableCell>
                  </TableRow>,
                ];

                if (open) {
                  for (const child of root.children) {
                    rows.push(
                      <TableRow
                        key={child.id}
                        className="border-b border-border/40 bg-muted/20 transition-colors hover:bg-muted/40"
                      >
                        <TableCell>
                          {/* Indent marks the child level — the row itself is flat,
                              so the table keeps one consistent column grid. */}
                          <div className="flex min-w-0 items-center gap-2 pl-6">
                            <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                            <Folder className="size-4 shrink-0 text-muted-foreground" />
                            <Link
                              href={`/urunler?categoryId=${child.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="truncate font-medium text-foreground transition-colors hover:text-primary hover:underline"
                              title={`${child.name} ürünlerini görüntüle`}
                            >
                              {child.name}
                            </Link>
                          </div>
                        </TableCell>
                        <MetricCells node={child} currency={currency} rate={rate} showKurus={showKurus} />
                        <TableCell className="w-16 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <ActionsMenu
                            node={child}
                            isRoot={false}
                            onAddChild={openCreate}
                            onEdit={openEdit}
                            onDelete={setDeleting}
                          />
                        </TableCell>
                      </TableRow>,
                    );
                  }
                }

                return rows;
              })
            )}
          </TableBody>
        </Table>
      </Card>
      </Section>
      </SectionStack>

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
              variant="destructive-solid"
              onClick={handleDelete}
            >
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
      <PageHeader title="Kategori Yönetimi" />
      <ForbiddenState message="Kategorileri görüntülemek için yetkiniz yok." />
    </div>
  );
}
