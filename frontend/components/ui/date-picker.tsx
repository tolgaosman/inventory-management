"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday as isTodayFn,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { tr } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "gg.aa.yyyy",
  disabled,
  className,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const selectedDate = value ? parseISO(value) : undefined;
  const minDate = min ? parseISO(min) : undefined;
  const maxDate = max ? parseISO(max) : undefined;

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selectedDate ?? new Date());

  const days = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const paddingStart = useMemo(() => {
    const start = startOfMonth(viewDate).getDay();
    return start === 0 ? 6 : start - 1;
  }, [viewDate]);

  const isDisabled = (day: Date) => {
    if (minDate && isBefore(day, minDate) && !isSameDay(day, minDate)) return true;
    if (maxDate && isAfter(day, maxDate) && !isSameDay(day, maxDate)) return true;
    return false;
  };

  const handleSelect = (day: Date) => {
    if (isDisabled(day)) return;
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setViewDate(selectedDate ?? new Date());
      }}
    >
      <PopoverTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30",
          className
        )}
      >
        <span className={cn(!selectedDate && "text-muted-foreground")}>
          {selectedDate ? format(selectedDate, "dd.MM.yyyy") : placeholder}
        </span>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <div className="flex items-center justify-between gap-2 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setViewDate((d) => subMonths(d, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium capitalize">
            {format(viewDate, "MMMM yyyy", { locale: tr })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setViewDate((d) => addMonths(d, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w} className="flex h-7 items-center justify-center">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: paddingStart }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {days.map((day) => {
            const selected = selectedDate ? isSameDay(day, selectedDate) : false;
            const disabledDay = isDisabled(day);
            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={disabledDay}
                onClick={() => handleSelect(day)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-30",
                  selected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  !selected && isTodayFn(day) && "ring-1 ring-ring",
                  !isSameMonth(day, viewDate) && "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
