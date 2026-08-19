"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppUser, Role } from "@/lib/types";
import type { Permission } from "@/lib/api/auth";
import { logout as apiLogout, me } from "@/lib/api/auth";
import { getToken } from "@/lib/api/client";

export type { Permission };

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: AppUser | null;
  userId: string;
  role: Role;
  name: string;
  initials: string;
  permissions: Permission[];
  mustChangePassword: boolean;
  can: (permission: Permission) => boolean;
  /** Re-reads the session from the server — call after login or a profile change. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function initialsFor(name: string, fallback: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || fallback
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AppUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const load = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setPermissions([]);
      setStatus("anonymous");
      return;
    }
    try {
      const session = await me();
      setUser(session.user);
      setPermissions(session.permissions);
      setStatus("authenticated");
    } catch {
      // apiFetch already cleared an invalid token and redirected.
      setUser(null);
      setPermissions([]);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setPermissions([]);
    setStatus("anonymous");
    router.push("/giris");
  }, [router]);

  const value = useMemo<AuthContextValue>(() => {
    const name = user?.name ?? "";

    return {
      status,
      user,
      userId: user?.id ?? "",
      role: (user?.role ?? "depo") as Role,
      name,
      initials: user ? initialsFor(name, user.initials) : "",
      permissions,
      mustChangePassword: user?.mustChangePassword ?? false,
      // Permissions come from the server; this copy only hides UI the user
      // couldn't use anyway — every route is enforced server-side too.
      can: (permission) => permissions.includes(permission),
      refresh: load,
      signOut,
    };
  }, [status, user, permissions, load, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
