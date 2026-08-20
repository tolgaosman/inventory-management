"use client";

import type { Permission } from "@/lib/auth";
import { useAuth } from "@/lib/auth";

export function Can({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission | Permission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can, status } = useAuth();

  if (status === "loading") {
    if (fallback) {
      return (
        <div className="flex min-h-[400px] w-full items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium animate-pulse">Yetkiler kontrol ediliyor...</p>
          </div>
        </div>
      );
    }
    return null;
  }

  const allowed = Array.isArray(permission) ? permission.some(can) : can(permission);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
