// Personal "recently deleted by me" bin — surfaced at the bottom of Ayarlar.
// Only lists records the current user soft-deleted themselves; each
// resource's own admin-side trashed filter (where it exists) is separate.
import { apiFetch } from "./client";

export type TrashItemType =
  | "product"
  | "category"
  | "supplier"
  | "warehouse"
  | "user"
  | "purchaseOrder"
  | "quoteRequest"
  | "movement";

export interface TrashItem {
  type: TrashItemType;
  id: string;
  label: string;
  deletedAt: string;
}

export async function listTrash(): Promise<TrashItem[]> {
  return apiFetch<TrashItem[]>("/trash");
}

export async function restoreTrashItem(type: TrashItemType, id: string): Promise<void> {
  await apiFetch<void>(`/trash/${type}/${id}/restore`, { method: "POST" });
}
