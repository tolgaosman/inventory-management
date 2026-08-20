"use client";

import { useState } from "react";
import { Check, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface DataTableColumnFilterProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { label: string; value: string }[];
  title?: string;
  className?: string;
}

export function DataTableColumnFilter({
  value,
  onValueChange,
  options,
  title,
  className,
}: DataTableColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const isFiltered = value && value !== "all" && value !== "";

  return (
    <div 
      onClick={(e) => e.stopPropagation()} 
      onPointerDown={(e) => e.stopPropagation()}
      className="inline-flex items-center"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-6 p-0 hover:bg-muted/50 data-[state=open]:bg-muted/50",
                isFiltered ? "text-primary" : "text-muted-foreground",
                className
              )}
              title={title || "Filtrele"}
            >
              <Filter className="size-3.5" />
            </Button>
          }
        />
        <PopoverContent align="start" className="w-[260px] p-0">
        <Command>
          <CommandInput placeholder={title || "Ara..."} />
          <CommandList>
            <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  onValueChange("all");
                  setOpen(false);
                }}
                className="text-xs py-2 border-b border-border/40 last:border-0 rounded-none"
              >
                <Check
                  className={cn(
                    "mr-2 size-4 shrink-0",
                    value === "all" || !value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="truncate flex-1">Tümü</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className="text-xs py-2 border-b border-border/40 last:border-0 rounded-none"
                >
                  <Check
                    className={cn(
                      "mr-2 size-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate flex-1" title={option.label}>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
      </Popover>
    </div>
  );
}
