"use client";

import { createContext, useContext, useMemo } from "react";
import type { Role } from "@/lib/types";
import { users } from "@/lib/mock/data";
import { useSettings } from "@/lib/settings-context";

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
  | "suppliers.manage"
  | "reports.view"
  | "users.manage";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  depo: ["products.view", "stock.in", "stock.out", "stock.transfer"],
  satinalma: ["products.view", "purchase.view", "purchase.manage", "suppliers.view", "suppliers.manage"],
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
    "suppliers.manage",
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
  const { role, setRole, userProfile } = useSettings();

  const value = useMemo<AuthContextValue>(() => {
    const asUser = users.find((u) => u.role === role) ?? users[0];
    const fullName = `${userProfile.firstName} ${userProfile.lastName}`.trim() || asUser.name;
    const initials =
      fullName
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || asUser.initials;

    return {
      userId: asUser.id,
      role,
      name: fullName,
      initials,
      can: (permission) => ROLE_PERMISSIONS[role].includes(permission),
      setRole,
    };
  }, [role, userProfile, setRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
