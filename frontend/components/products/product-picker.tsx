"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { products } from "@/lib/mock/data";

export function ProductPicker({
  value,
  onChange,
  placeholder = "Ürün seçin…",
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? `${selected.name} (${selected.sku})` : placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[--anchor-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Ürün veya SKU ara…" />
          <CommandList>
            <CommandEmpty>Ürün bulunamadı.</CommandEmpty>
            <CommandGroup>
              {products.slice(0, 200).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.sku}`}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.sku}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
