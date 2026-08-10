"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table2, ChartSpline } from "lucide-react";

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
    <Card className={`shadow-soft border-border/70 gap-4 py-5 ${className ?? ""}`}>
      <CardHeader className="flex-row items-start justify-between gap-3 px-5">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {legend}
          {tableView ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={() => setShowTable((s) => !s)}
              aria-label={showTable ? "Grafik görünümü" : "Tablo görünümü"}
              title={showTable ? "Grafik görünümü" : "Tablo görünümü"}
            >
              {showTable ? <ChartSpline className="size-4" /> : <Table2 className="size-4" />}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="px-5">{showTable && tableView ? tableView : children}</CardContent>
    </Card>
  );
}
