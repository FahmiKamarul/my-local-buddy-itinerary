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

  // Generate calendar grid for the current view month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Monday = 0, Sunday = 6 (ISO week)
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const grid: (number | null)[] = [];

    // Leading empty cells
    for (let i = 0; i < startDow; i++) grid.push(null);
    // Day numbers
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

    // Don't allow past dates
    if (dateStr < todayStr) return;

    if (!startDate || (startDate && endDate)) {
      // First click or reset: set start date
      onSelect(dateStr, null);
    } else {
      // Second click: set end date
      if (dateStr < startDate) {
        // Clicked before start — swap
        onSelect(dateStr, startDate);
      } else if (dateStr === startDate) {
        // Same day trip
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
      base += "text-zinc-300 dark:text-zinc-600 cursor-not-allowed";
    } else if (isStart || isEnd) {
      base += "bg-amber-500 text-white font-bold shadow-md";
    } else if (isInRange) {
      base += "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-medium";
    } else if (isToday) {
      base += "border-2 border-amber-400 text-zinc-900 dark:text-zinc-100 font-medium cursor-pointer hover:bg-amber-50 dark:hover:bg-zinc-700";
    } else {
      base += "text-zinc-800 dark:text-zinc-200 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700";
    }

    return base;
  }

  // Can't go before current month
  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  return (
    <div className="w-full rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 shadow-sm">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
          {MONTHS[viewMonth]} {viewYear}
        </h3>
        <button
          type="button"
          onClick={handleNextMonth}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-zinc-400 dark:text-zinc-500 py-1">
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
      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-700">
        <div className="space-y-0.5">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Start</p>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {startDate ? formatDisplayDate(startDate) : "—"}
          </p>
        </div>
        <div className="text-zinc-300 dark:text-zinc-600">→</div>
        <div className="space-y-0.5 text-right">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">End</p>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
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
