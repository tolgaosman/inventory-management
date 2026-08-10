"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Role } from "@/lib/types";
import { users } from "@/lib/mock/data";

export type Permission =
  | "products.view"
  | "products.manage"
  | "warehouses.manage"
  | "stock.in"
  | "stock.out"
  | "stock.transfer"
  | "purchase.view"
  | "purchase.manage"
  | "suppliers.view"
  | "reports.view"
  | "users.manage";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  depo: ["products.view", "stock.in", "stock.out", "stock.transfer"],
  satinalma: ["products.view", "purchase.view", "purchase.manage", "suppliers.view"],
  yonetici: [
    "products.view",
    "products.manage",
    "warehouses.manage",
    "stock.in",
    "stock.out",
    "stock.transfer",
    "purchase.view",
    "purchase.manage",
    "suppliers.view",
    "reports.view",
    "users.manage",
  ],
};

interface AuthContextValue {
  userId: string;
  role: Role;
  name: string;
  initials: string;
  can: (permission: Permission) => boolean;
  setRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>("yonetici");

  const value = useMemo<AuthContextValue>(() => {
    const asUser = users.find((u) => u.role === role) ?? users[0];
    return {
      userId: asUser.id,
      role,
      name: asUser.name,
      initials: asUser.initials,
      can: (permission) => ROLE_PERMISSIONS[role].includes(permission),
      setRole,
    };
  }, [role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
