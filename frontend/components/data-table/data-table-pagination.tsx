import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: DataTablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={cn("flex flex-wrap items-center gap-4 border-t border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground", className)}>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          title="İlk Sayfa"
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          title="Önceki Sayfa"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          title="Sonraki Sayfa"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page >= pageCount}
          onClick={() => onPageChange(pageCount)}
          title="Son Sayfa"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
      <p>
        <span className="font-medium text-foreground">
          {formatNumber((page - 1) * pageSize + 1)}–{formatNumber(Math.min(page * pageSize, total))}
        </span>{" "}
        / {formatNumber(total)} kayıt · Sayfa {page} / {pageCount}
      </p>
    </div>
  );
}
