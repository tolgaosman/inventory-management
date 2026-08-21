// Dynamic roles — backend/app/Http/Controllers/Api/RoleController.php, admin-only
// (backend/app/Http/Middleware/EnsureAdmin.php). The 5 built-in roles are seeded
// as `isSystem: true` rows and can't be renamed/deleted, but their permission
// set can still be edited here like any custom role.
import type { Permission } from "./auth";
import { apiFetch } from "./client";

export interface RoleRow {
  id: string;
  name: string;
  isSystem: boolean;
  userCount: number;
  permissions: Permission[];
}

export async function listRoles(): Promise<RoleRow[]> {
  return apiFetch<RoleRow[]>("/roles");
}

export interface RoleInput {
  name: string;
  permissions: Permission[];
}

export async function createRole(input: RoleInput): Promise<RoleRow> {
  return apiFetch<RoleRow>("/roles", { method: "POST", body: input });
}

export async function updateRole(id: string, input: RoleInput): Promise<RoleRow> {
  return apiFetch<RoleRow>(`/roles/${id}`, { method: "PUT", body: input });
}

export async function deleteRole(id: string): Promise<boolean> {
  await apiFetch<{ deleted: boolean }>(`/roles/${id}`, { method: "DELETE" });
  return true;
}
