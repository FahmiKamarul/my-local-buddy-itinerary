"use client";

import { useState, useMemo } from "react";

interface CalendarPickerProps {
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD
  onSelect: (startDate: string, endDate: string | null) => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a: string, b: string): boolean {
  return a === b;
}

function isBetween(date: string, start: string, end: string): boolean {
  return date > start && date < end;
}

export default function CalendarPicker({ startDate, endDate, onSelect }: CalendarPickerProps) {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const grid: (number | null)[] = [];

    for (let i = 0; i < startDow; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(d);

    return grid;
  }, [viewMonth, viewYear]);

  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function handleDayClick(day: number) {
    const dateStr = toDateStr(viewYear, viewMonth, day);
    if (dateStr < todayStr) return;

    if (!startDate || (startDate && endDate)) {
      onSelect(dateStr, null);
    } else {
      if (dateStr < startDate) {
        onSelect(dateStr, startDate);
      } else if (dateStr === startDate) {
        onSelect(dateStr, dateStr);
      } else {
        onSelect(startDate, dateStr);
      }
    }
  }

  function getDayClasses(day: number): string {
    const dateStr = toDateStr(viewYear, viewMonth, day);
    const isPast = dateStr < todayStr;
    const isStart = startDate && isSameDay(dateStr, startDate);
    const isEnd = endDate && isSameDay(dateStr, endDate);
    const isInRange = startDate && endDate && isBetween(dateStr, startDate, endDate);
    const isToday = isSameDay(dateStr, todayStr);

    let base = "min-h-[40px] min-w-[40px] flex items-center justify-center text-sm rounded-full transition-all ";

    if (isPast) {
      base += "text-muted/40 cursor-not-allowed";
    } else if (isStart || isEnd) {
      base += "bg-accent text-white font-bold shadow-md";
    } else if (isInRange) {
      base += "bg-accent/15 text-accent font-medium";
    } else if (isToday) {
      base += "border-2 border-accent text-foreground font-medium cursor-pointer hover:bg-accent/10";
    } else {
      base += "text-foreground cursor-pointer hover:bg-surface-alt";
    }

    return base;
  }

  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  return (
    <div className="w-full rounded-2xl bg-surface border border-primary-light/20 p-4 space-y-3 shadow-sm">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-primary hover:bg-surface-alt disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3 className="text-sm font-bold text-foreground">
          {MONTHS[viewMonth]} {viewYear}
        </h3>
        <button
          type="button"
          onClick={handleNextMonth}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-primary hover:bg-surface-alt transition-colors"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, i) => (
          <div key={i} className="flex items-center justify-center">
            {day ? (
              <button
                type="button"
                onClick={() => handleDayClick(day)}
                disabled={toDateStr(viewYear, viewMonth, day) < todayStr}
                className={getDayClasses(day)}
              >
                {day}
              </button>
            ) : (
              <div className="min-h-[40px] min-w-[40px]" />
            )}
          </div>
        ))}
      </div>

      {/* Selection summary */}
      <div className="flex items-center justify-between pt-2 border-t border-primary-light/20">
        <div className="space-y-0.5">
          <p className="text-xs text-muted uppercase tracking-wide">Start</p>
          <p className="text-sm font-semibold text-foreground">
            {startDate ? formatDisplayDate(startDate) : "—"}
          </p>
        </div>
        <div className="text-primary-light">→</div>
        <div className="space-y-0.5 text-right">
          <p className="text-xs text-muted uppercase tracking-wide">End</p>
          <p className="text-sm font-semibold text-foreground">
            {endDate ? formatDisplayDate(endDate) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatDisplayDate(dateStr: string): string {
  const d = parseDate(dateStr);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()].slice(0, 3);
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}
