import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function KpiPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-soft border-border/70 gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-5 px-5">{children}</CardContent>
    </Card>
  );
}
