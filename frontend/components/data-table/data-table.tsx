"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
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
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((header) => {
                    const sortable = header.column.columnDef.enableSorting !== false && onSortingChange;
                    const sortDir = header.column.getIsSorted();
                    return (
                      <TableHead key={header.id} className="whitespace-nowrap">
                        {header.isPlaceholder ? null : sortable ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex items-center gap-1 select-none hover:text-foreground"
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
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
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
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
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
            Toplam <span className="font-medium text-foreground">{formatNumber(total)}</span> kayıt · Sayfa{" "}
            {page} / {pageCount}
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
              Sonraki
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
