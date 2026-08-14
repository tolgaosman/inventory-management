"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
  type OnChangeFn,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // Type params are required to match the augmented interface's signature even though unused here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Applied to both the header cell and body cells, e.g. to right-align a price column. */
    className?: string;
    /** Applied to the header cell only, in addition to `className`. */
    headClassName?: string;
  }
}

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  error?: Error;
  onRetry?: () => void;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  emptyTitle?: string;
  emptyDescription?: string;
  isFiltered?: boolean;
  rowHref?: (row: T) => string | undefined;
}

export function DataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  error,
  onRetry,
  sorting,
  onSortingChange,
  emptyTitle = "Kayıt bulunamadı",
  emptyDescription,
  isFiltered,
}: DataTableProps<T>) {
  // TanStack Table's useReactTable() returns functions that the React
  // Compiler can't safely memoize — inherent to the library, not a bug here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: sorting ? { sorting } : undefined,
    onSortingChange,
    manualSorting: true,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  if (error) {
    return <ErrorState message={error.message} onRetry={onRetry} />;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto custom-scrollbar">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="border-b border-border/70 hover:bg-transparent">
                  {hg.headers.map((header) => {
                    const sortable = header.column.columnDef.enableSorting !== false && onSortingChange;
                    const sortDir = header.column.getIsSorted();
                    const meta = header.column.columnDef.meta;
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(meta?.className, meta?.headClassName)}
                      >
                        {header.isPlaceholder ? null : sortable ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              "inline-flex items-center gap-1 select-none hover:text-foreground",
                              String(meta?.className ?? "").includes("text-right") && "justify-end w-full",
                              String(meta?.className ?? "").includes("text-center") && "justify-center w-full",
                            )}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortDir === "asc" ? (
                              <ChevronUp className="size-3.5" />
                            ) : sortDir === "desc" ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronsUpDown className="size-3.5 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <TableRow key={i} className="border-b border-border/50">
                    {columns.map((_, j) => (
                      <TableCell key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState
                      title={isFiltered ? "Filtrelere uyan kayıt yok" : emptyTitle}
                      description={
                        isFiltered
                          ? "Farklı filtreler deneyin veya filtreleri temizleyin."
                          : emptyDescription
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn("px-4 py-3 text-sm", cell.column.columnDef.meta?.className)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {!loading && data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">
              {formatNumber((page - 1) * pageSize + 1)}–{formatNumber(Math.min(page * pageSize, total))}
            </span>{" "}
            / {formatNumber(total)} kayıt · Sayfa {page} / {pageCount}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="size-4" />
              Önceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              Sonraki Sayfa
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
