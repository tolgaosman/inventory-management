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
  const { can } = useAuth();
  const allowed = Array.isArray(permission) ? permission.some(can) : can(permission);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
