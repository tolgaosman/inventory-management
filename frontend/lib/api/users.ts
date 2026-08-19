import type { AppUser, Role } from "@/lib/types";
import { apiFetch } from "./client";

export interface UserInput {
  name: string;
  email: string;
  role: Role;
}

export async function listAppUsers(): Promise<AppUser[]> {
  return apiFetch<AppUser[]>("/users");
}

export async function createAppUser(input: UserInput): Promise<AppUser> {
  return apiFetch<AppUser>("/users", { method: "POST", body: input });
}

export async function updateAppUser(id: string, input: Partial<UserInput>): Promise<AppUser> {
  return apiFetch<AppUser>(`/users/${id}`, { method: "PUT", body: input });
}

export async function deleteAppUser(id: string): Promise<boolean> {
  await apiFetch<{ deleted: boolean }>(`/users/${id}`, { method: "DELETE" });
  return true;
}
