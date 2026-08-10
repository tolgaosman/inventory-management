"use client";

import type { Permission } from "@/lib/auth";
import { useAuth } from "@/lib/auth";

export function Can({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can } = useAuth();
  if (!can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
