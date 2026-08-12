// Category management: hierarchical (max 2 levels) CRUD over the mock catalog.
// Mirrors lib/api/warehouses.ts — mutates the in-memory arrays and throws
// ApiError with Turkish messages so the UI can surface them verbatim.
import { categories, products, stockLevels } from "@/lib/mock/data";
import { ApiError, delay, matchesSearch } from "./client";
import type { Category } from "@/lib/types";

/** A category enriched with rolled-up stock metrics. */
export interface CategoryNode extends Category {
  /** Products assigned directly to this category. */
  productCount: number;
  /** Units on hand across every warehouse. */
  totalUnits: number;
  /** Stock value in TRY (base currency); format at the call site. */
  totalValue: number;
  /** Products whose total stock sits below their minimum. */
  criticalCount: number;
  /** Only ever populated on root categories — the tree is 2 levels deep. */
  children: CategoryNode[];
}

export interface CategoryTreeQuery {
  search?: string;
}

export interface CategoryStats {
  total: number;
  rootCount: number;
  childCount: number;
  criticalCategoryCount: number;
}

export interface CategoryTreeResult {
  /** Root categories with their children, filtered by `search`. */
  tree: CategoryNode[];
  /** Every category, flat and unfiltered — feeds the form's parent picker. */
  all: Category[];
  stats: CategoryStats;
}

export interface CategoryInput {
  name: string;
  /** `null` (or omitted) makes this a root category. */
  parentId: string | null;
}

const collator = new Intl.Collator("tr-TR");

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}

/** Own metrics for a single category, ignoring any children. */
function ownMetrics(categoryId: string) {
  const own = products.filter((p) => p.categoryId === categoryId);
  let totalUnits = 0;
  let totalValue = 0;
  let criticalCount = 0;

  own.forEach((p) => {
    const units = stockLevels
      .filter((s) => s.productId === p.id)
      .reduce((sum, s) => sum + s.quantity, 0);
    totalUnits += units;
    totalValue += units * p.purchasePrice;
    if (units < p.minStock) criticalCount += 1;
  });

  return { productCount: own.length, totalUnits, totalValue, criticalCount };
}

function toNode(category: Category): CategoryNode {
  return { ...category, ...ownMetrics(category.id), children: [] };
}

/**
 * Builds the category tree with metrics rolled up from children into their
 * parent. `search` keeps a child whose name matches (pulling its parent along)
 * and keeps every child of a parent that matches itself.
 */
export async function listCategoryTree(query: CategoryTreeQuery = {}): Promise<CategoryTreeResult> {
  const roots = categories
    .filter((c) => c.parentId === null)
    .map(toNode)
    .sort((a, b) => collator.compare(a.name, b.name));

  roots.forEach((root) => {
    root.children = categories
      .filter((c) => c.parentId === root.id)
      .map(toNode)
      .sort((a, b) => collator.compare(a.name, b.name));

    root.children.forEach((child) => {
      root.productCount += child.productCount;
      root.totalUnits += child.totalUnits;
      root.totalValue += child.totalValue;
      root.criticalCount += child.criticalCount;
    });
  });

  // Stats describe the whole catalog, not the filtered view.
  const rootCount = roots.length;
  const childCount = categories.length - rootCount;
  const criticalCategoryCount = roots.reduce(
    (sum, r) => sum + (r.criticalCount > 0 ? 1 : 0) + r.children.filter((c) => c.criticalCount > 0).length,
    0,
  );

  let tree = roots;
  if (query.search) {
    tree = roots
      .map((root) => {
        if (matchesSearch([root.name], query.search)) return root;
        const children = root.children.filter((c) => matchesSearch([c.name], query.search));
        return children.length ? { ...root, children } : null;
      })
      .filter((r): r is CategoryNode => r !== null);
  }

  return delay({
    tree,
    all: categories.map((c) => ({ ...c })),
    stats: { total: categories.length, rootCount, childCount, criticalCategoryCount },
  });
}

/** `cat-` + an ascii slug of the name, with a numeric suffix on collision. */
function buildId(name: string): string {
  const slug = name
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const base = `cat-${slug || "kategori"}`;
  if (!categories.some((c) => c.id === base)) return base;

  let suffix = 2;
  while (categories.some((c) => c.id === `${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** Shared name/parent validation for create and update. */
function assertValidPlacement(name: string, parentId: string | null, ignoreId?: string): void {
  if (!name.trim()) throw new ApiError("Kategori adı gereklidir.", "VALIDATION");

  if (parentId !== null) {
    const parent = categories.find((c) => c.id === parentId);
    if (!parent) throw new ApiError("Üst kategori bulunamadı.", "NOT_FOUND");
    if (parent.parentId !== null) {
      throw new ApiError("Alt kategorinin altına kategori eklenemez (en fazla 2 seviye).", "VALIDATION");
    }
  }

  const duplicate = categories.some(
    (c) => c.id !== ignoreId && c.parentId === parentId && normalize(c.name) === normalize(name),
  );
  if (duplicate) {
    throw new ApiError(
      parentId === null
        ? "Bu isimde bir üst kategori zaten var."
        : "Bu üst kategori altında aynı isimde bir alt kategori zaten var.",
      "CONFLICT",
    );
  }
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const parentId = input.parentId || null;
  assertValidPlacement(input.name, parentId);

  const created: Category = { id: buildId(input.name), name: input.name.trim(), parentId };
  categories.push(created);
  return delay(created, 400);
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  const category = categories.find((c) => c.id === id);
  if (!category) throw new ApiError("Kategori bulunamadı.", "NOT_FOUND");

  const parentId = input.parentId || null;
  if (parentId === id) throw new ApiError("Bir kategori kendi alt kategorisi olamaz.", "VALIDATION");

  const hasChildren = categories.some((c) => c.parentId === id);
  if (hasChildren && parentId !== null) {
    throw new ApiError(
      "Alt kategorileri olan bir kategori başka kategorinin altına taşınamaz.",
      "VALIDATION",
    );
  }

  assertValidPlacement(input.name, parentId, id);

  category.name = input.name.trim();
  category.parentId = parentId;
  return delay(category, 400);
}

export async function deleteCategory(id: string): Promise<boolean> {
  const index = categories.findIndex((c) => c.id === id);
  if (index === -1) throw new ApiError("Kategori bulunamadı.", "NOT_FOUND");

  const childCount = categories.filter((c) => c.parentId === id).length;
  if (childCount > 0) {
    throw new ApiError(
      `Bu kategorinin ${childCount} alt kategorisi olduğu için silinemez. Önce alt kategorileri silin.`,
      "CONFLICT",
    );
  }

  const productCount = products.filter((p) => p.categoryId === id).length;
  if (productCount > 0) {
    throw new ApiError(
      `Bu kategoriye bağlı ${productCount} ürün olduğu için silinemez. Önce ürünleri başka bir kategoriye taşıyın.`,
      "CONFLICT",
    );
  }

  categories.splice(index, 1);
  return delay(true, 400);
}
