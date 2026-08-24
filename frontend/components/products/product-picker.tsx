"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { getProduct, listProducts } from "@/lib/api/products";
import { useAsync } from "@/lib/hooks/use-async";

export function ProductPicker({
  value,
  onChange,
  placeholder = "Ürün seçin…",
  stockByProductId,
  excludeZeroStock = false,
  supplierId,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** When provided, shows each product's quantity in the currently selected warehouse. */
  stockByProductId?: Record<string, number>;
  /** When true, hides products that have 0 stock according to stockByProductId. */
  excludeZeroStock?: boolean;
  /** When provided, restricts the list to this supplier's products. */
  supplierId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { status, data } = useAsync(
    () => listProducts({ search: debouncedSearch, pageSize: 50, supplierId }),
    [debouncedSearch, supplierId],
  );
  const rows = data?.rows ?? [];

  // The current selection may not be present in the (search-filtered) `rows`
  // page, so it's looked up directly to keep the trigger label correct.
  const { data: selectedProduct } = useAsync(
    () => (value ? getProduct(value) : Promise.resolve(undefined)),
    [value],
  );
  const selected = rows.find((p) => p.id === value) ?? selectedProduct;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal overflow-hidden min-w-0 shrink"
          />
        }
      >
        <span className={cn("truncate min-w-0 flex-1 text-left", !selected && "text-muted-foreground")}>
          {selected ? `${selected.name} (${selected.sku})` : placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[--anchor-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Ürün veya SKU ara…" value={search} onValueChange={setSearch} />
          <CommandList>
            {status === "loading" ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Aranıyor…
              </div>
            ) : (
              <CommandEmpty>Ürün bulunamadı.</CommandEmpty>
            )}
            <CommandGroup>
              {rows
                .filter((p) => !excludeZeroStock || !stockByProductId || stockByProductId[p.id] > 0)
                .map((p) => {
                const stock = stockByProductId?.[p.id];
                return (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    disabled={p.status === "pasif"}
                    className={cn(p.status === "pasif" && "opacity-60")}
                    onSelect={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === p.id ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.sku}</span>
                    {stockByProductId && (
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {formatNumber(stock ?? 0)}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
