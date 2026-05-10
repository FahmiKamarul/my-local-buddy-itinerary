"use client";

import { useState } from "react";
import { validateTimeWindow } from "@/lib/time-utils";
import CalendarPicker from "./CalendarPicker";

interface TimeWindowInputProps {
  onConfirm: (arrivalTime: string, departureTime: string, startDate: string, endDate: string) => void;
  loading?: boolean;
}

export default function TimeWindowInput({ onConfirm, loading }: TimeWindowInputProps) {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [arrival, setArrival] = useState("09:00");
  const [departure, setDeparture] = useState("18:00");
  const [error, setError] = useState<string | null>(null);

  function handleDateSelect(start: string, end: string | null) {
    setStartDate(start);
    setEndDate(end);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!startDate) {
      setError("Eh, pick your trip dates lah! Tap a start date on the calendar.");
      return;
    }

    if (!endDate) {
      setError("Now tap an end date — or tap the same day for a day trip!");
      return;
    }

    const result = validateTimeWindow(arrival, departure);
    if (!result.valid) {
      setError(result.error);
      return;
    }

    setError(null);
    onConfirm(arrival, departure, startDate, endDate);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <p className="text-sm text-muted">
        Pick your trip dates and time window so we can plan your day properly lah!
      </p>

      {/* Calendar date picker */}
      <CalendarPicker
        startDate={startDate}
        endDate={endDate}
        onSelect={handleDateSelect}
      />

      {/* Time pickers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="arrival" className="block text-xs font-medium text-primary uppercase tracking-wide">
            Start Time
          </label>
          <input
            id="arrival"
            type="time"
            value={arrival}
            onChange={(e) => { setArrival(e.target.value); setError(null); }}
            disabled={loading}
            className="w-full min-h-[44px] rounded-xl border border-primary-light/40 bg-surface px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:opacity-50 transition-all"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="departure" className="block text-xs font-medium text-primary uppercase tracking-wide">
            End Time
          </label>
          <input
            id="departure"
            type="time"
            value={departure}
            onChange={(e) => { setDeparture(e.target.value); setError(null); }}
            disabled={loading}
            className="w-full min-h-[44px] rounded-xl border border-primary-light/40 bg-surface px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:opacity-50 transition-all"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[44px] rounded-xl bg-accent hover:bg-accent-hover px-6 py-3 text-base font-semibold text-white shadow-lg shadow-accent/25 active:scale-95 transition-all disabled:opacity-50"
      >
        {loading ? "Generating lah..." : "Generate My Itinerary 🗓️"}
      </button>
    </form>
  );
}
