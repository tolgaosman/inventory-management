// Category management: hierarchical (max 2 levels) CRUD. The server enforces
// the depth limit, sibling-name uniqueness and delete guards, and returns
// Turkish messages the UI surfaces verbatim.
import type { Category } from "@/lib/types";
import { apiFetch } from "./client";

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

export async function listCategoryTree(query: CategoryTreeQuery = {}): Promise<CategoryTreeResult> {
  return apiFetch<CategoryTreeResult>("/categories/tree", { query: { search: query.search } });
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  return apiFetch<Category>("/categories", { method: "POST", body: input });
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  return apiFetch<Category>(`/categories/${id}`, { method: "PUT", body: input });
}

export async function deleteCategory(id: string): Promise<boolean> {
  await apiFetch<{ deleted: boolean }>(`/categories/${id}`, { method: "DELETE" });
  return true;
}
