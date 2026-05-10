"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DestinationInput from "@/components/DestinationInput";
import CalendarPicker from "@/components/CalendarPicker";
import LoadingIndicator from "@/components/LoadingIndicator";
import ErrorMessage from "@/components/ErrorMessage";
import { validateTimeWindow } from "@/lib/time-utils";

type Step = "destination" | "dates" | "loading";

export default function HomePage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<Step>("destination");

  // Form data
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [arrivalTime, setArrivalTime] = useState("09:00");
  const [departureTime, setDepartureTime] = useState("18:00");

  // UI state
  const [error, setError] = useState<string | null>(null);

  // Calculate trip duration in days
  function getTripDays(): number {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }

  // Step 1: Destination submitted
  function handleDestinationSubmit(dest: string) {
    setDestination(dest);
    setError(null);
    setStep("dates");
  }

  // Step 2: Calendar date selection
  function handleDateSelect(start: string, end: string | null) {
    setStartDate(start);
    setEndDate(end);
    setError(null);
  }

  // Step 2: Final submit — generate deck
  async function handleGenerateDeck(e: React.FormEvent) {
    e.preventDefault();

    if (!startDate) {
      setError("Eh, pick your trip start date lah!");
      return;
    }
    if (!endDate) {
      setError("Now tap an end date — or tap the same day for a day trip!");
      return;
    }

    const timeResult = validateTimeWindow(arrivalTime, departureTime);
    if (!timeResult.valid) {
      setError(timeResult.error);
      return;
    }

    setError(null);
    setStep("loading");

    const tripDays = getTripDays();

    try {
      const res = await fetch("/api/generate-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          tripDays,
          startDate,
          endDate,
          arrivalTime,
          departureTime,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Aiyoh, something went wrong lah. Jom try again?");
        setStep("dates");
        return;
      }

      // Store everything in sessionStorage for the swipe page
      sessionStorage.setItem("mybuddy_deck", JSON.stringify(data.deck));
      sessionStorage.setItem("mybuddy_destination", destination);
      sessionStorage.setItem("mybuddy_trip_start", startDate);
      sessionStorage.setItem("mybuddy_trip_end", endDate);
      sessionStorage.setItem("mybuddy_trip_days", String(tripDays));
      sessionStorage.setItem("mybuddy_arrival_time", arrivalTime);
      sessionStorage.setItem("mybuddy_departure_time", departureTime);

      router.push("/swipe");
    } catch {
      setError("Aiyoh, network error lah. Check your connection and try again boleh?");
      setStep("dates");
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            🇲🇾 MY Buddy
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Your local Malaysian trip planner lah!
          </p>
        </div>

        {/* Step 1: Destination */}
        {step === "destination" && (
          <DestinationInput onSubmit={handleDestinationSubmit} />
        )}

        {/* Step 2: Dates & Times */}
        {step === "dates" && (
          <form onSubmit={handleGenerateDeck} className="space-y-5">
            {/* Destination badge — tap to go back */}
            <button
              type="button"
              onClick={() => setStep("destination")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
            >
              <span>📍</span>
              <span>{destination}</span>
              <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">Change</span>
            </button>

            {/* Calendar */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                When you going?
              </h2>
              <CalendarPicker
                startDate={startDate}
                endDate={endDate}
                onSelect={handleDateSelect}
              />
            </div>

            {/* Trip duration indicator */}
            {startDate && endDate && (
              <div className="flex items-center justify-center gap-2 py-2">
                <span className="text-2xl">🏖️</span>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {getTripDays()} day{getTripDays() > 1 ? "s" : ""} trip
                </p>
              </div>
            )}

            {/* Daily time window */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Daily time window
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="arrival" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Start
                  </label>
                  <input
                    id="arrival"
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => { setArrivalTime(e.target.value); setError(null); }}
                    className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-base text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="departure" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    End
                  </label>
                  <input
                    id="departure"
                    type="time"
                    value={departureTime}
                    onChange={(e) => { setDepartureTime(e.target.value); setError(null); }}
                    className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-base text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Error */}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            {/* Submit */}
            <button
              type="submit"
              disabled={!startDate || !endDate}
              className="w-full min-h-[44px] rounded-xl bg-amber-500 px-6 py-3 text-base font-semibold text-white active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Jom, Show Me Cards! 🃏
            </button>
          </form>
        )}

        {/* Loading */}
        {step === "loading" && <LoadingIndicator />}

        {/* Error on loading step */}
        {step !== "loading" && error && step === "destination" && (
          <ErrorMessage message={error} onRetry={() => setError(null)} />
        )}
      </div>
    </div>
  );
}
