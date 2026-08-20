import type { AppUser, Role } from "@/lib/types";
import { apiFetch } from "./client";
import { cachedFetch, invalidateCache } from "@/lib/api-cache";

export interface UserInput {
  name: string;
  email: string;
  role: Role;
}

export async function listAppUsers(): Promise<AppUser[]> {
  // Same cache key as lib/api/catalog.ts's listUsers — both hit GET /users
  // with no params, so sharing the key dedupes across the two call sites too.
  return cachedFetch("users:list", () => apiFetch<AppUser[]>("/users"), 30_000);
}

function invalidateUsers() {
  invalidateCache("users:");
}

export async function createAppUser(input: UserInput): Promise<AppUser> {
  invalidateUsers();
  return apiFetch<AppUser>("/users", { method: "POST", body: input });
}

export async function updateAppUser(id: string, input: Partial<UserInput>): Promise<AppUser> {
  invalidateUsers();
  return apiFetch<AppUser>(`/users/${id}`, { method: "PUT", body: input });
}

export async function deleteAppUser(id: string): Promise<boolean> {
  invalidateUsers();
  await apiFetch<{ deleted: boolean }>(`/users/${id}`, { method: "DELETE" });
  return true;
}

export async function restoreUser(id: string): Promise<void> {
  invalidateUsers();
  await apiFetch<void>(`/users/${id}/restore`, { method: "POST" });
}
