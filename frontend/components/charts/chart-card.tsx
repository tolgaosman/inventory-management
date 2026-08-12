"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table2, ChartSpline } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  description,
  legend,
  tableView,
  children,
  className,
}: {
  title: string;
  description?: string;
  legend?: React.ReactNode;
  /** Accessible table-view twin, toggled with the button in the header. */
  tableView?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <CardTitle>{title}</CardTitle>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {legend}
          {tableView ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              onClick={() => setShowTable((s) => !s)}
              aria-label={showTable ? "Grafik görünümü" : "Tablo görünümü"}
              title={showTable ? "Grafik görünümü" : "Tablo görünümü"}
            >
              {showTable ? <ChartSpline className="size-4" /> : <Table2 className="size-4" />}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>{showTable && tableView ? tableView : children}</CardContent>
    </Card>
  );
}
