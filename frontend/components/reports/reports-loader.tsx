"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[70px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-8 w-72 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Skeleton className="h-[400px] rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    </div>
  );
}

const ReportsClientInner = dynamic(
  () => import("./reports-client").then((m) => ({ default: m.ReportsClient })),
  { ssr: false, loading: () => <ReportsSkeleton /> },
);

export function ReportsLoader() {
  return <ReportsClientInner />;
}
