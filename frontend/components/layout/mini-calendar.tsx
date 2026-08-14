"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function MiniCalendar() {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let firstDayIndex = new Date(year, month, 1).getDay() - 1;
  if (firstDayIndex < 0) firstDayIndex = 6;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingArray = Array.from({ length: firstDayIndex }, (_, i) => i);

  return (
    <div className="p-3 text-popover-foreground select-none shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium text-sidebar-foreground">
          {MONTH_NAMES[month]} {year}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title="Önceki Ay"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title="Sonraki Ay"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {DAY_NAMES.map((day) => (
          <span key={day} className="text-micro text-sidebar-foreground/45 uppercase">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
        {paddingArray.map((p) => (
          <div key={`pad-${p}`} className="h-6" />
        ))}
        {daysArray.map((day) => {
          const isToday = isCurrentMonth && day === todayDate;
          return (
            <div key={day} className="flex items-center justify-center h-6">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-md text-micro tabular-nums transition-colors",
                  isToday
                    ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                {day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
