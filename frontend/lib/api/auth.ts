import type { AppUser } from "@/lib/types";
import { apiFetch, clearToken, setToken } from "./client";

export type Permission =
  | "products.view"
  | "products.manage"
  | "warehouses.manage"
  | "stock.view"
  | "stock.in"
  | "stock.out"
  | "stock.transfer"
  | "purchase.view"
  | "purchase.manage"
  | "purchase.approve"
  | "purchase.receive"
  | "suppliers.view"
  | "suppliers.manage"
  | "reports.stock"
  | "reports.financial"
  | "financial.view"
  | "users.manage"
  | "roles.manage";

export interface Session {
  user: AppUser;
  permissions: Permission[];
}

export async function login(email: string, password: string): Promise<Session> {
  const result = await apiFetch<{ token: string } & Session>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  setToken(result.token);
  return { user: result.user, permissions: result.permissions };
}

export async function me(): Promise<Session> {
  return apiFetch<Session>("/auth/me");
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<void>("/auth/logout", { method: "POST" });
  } finally {
    // The local session goes away even if the revoke call fails.
    clearToken();
  }
}

export async function forgotPassword(email: string): Promise<{ message: string; debugToken?: string }> {
  return apiFetch("/auth/forgot-password", { method: "POST", body: { email } });
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
}): Promise<{ message: string }> {
  return apiFetch("/auth/change-password", {
    method: "POST",
    body: {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      newPassword_confirmation: input.newPasswordConfirmation,
    },
  });
}

export async function resetPassword(input: {
  email: string;
  token: string;
  password: string;
  passwordConfirmation: string;
}): Promise<{ message: string }> {
  return apiFetch("/auth/reset-password", {
    method: "POST",
    body: {
      email: input.email,
      token: input.token,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    },
  });
}
