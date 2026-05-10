"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RouteTabBar from "@/components/RouteTabBar";
import ActivitySchedule from "@/components/ActivitySchedule";
import LoadingIndicator from "@/components/LoadingIndicator";
import ErrorMessage from "@/components/ErrorMessage";
import type { Card, ItineraryResult, DaySchedule } from "@/lib/schemas";

type RouteType = "optimized" | "makan-focused" | "santai";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]}, ${d} ${MONTH_SHORT[m - 1]}`;
}

function formatTripDates(): string {
  if (typeof window === "undefined") return "";
  const start = sessionStorage.getItem("mybuddy_trip_start");
  const end = sessionStorage.getItem("mybuddy_trip_end");
  if (!start) return "";
  const [, sm, sd] = start.split("-").map(Number);
  const startStr = `${sd} ${MONTH_SHORT[sm - 1]}`;
  if (!end || end === start) return startStr;
  const [, em, ed] = end.split("-").map(Number);
  const endStr = `${ed} ${MONTH_SHORT[em - 1]}`;
  return `${startStr} – ${endStr}`;
}

export default function ItineraryPage() {
  const router = useRouter();
  const [acceptedCards, setAcceptedCards] = useState<Card[] | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteType>("optimized");
  const [selectedDay, setSelectedDay] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("mybuddy_accepted");
    if (!stored) {
      setError("No accepted cards found lah. Go back and swipe some cards first.");
      return;
    }

    try {
      const cards = JSON.parse(stored);
      setAcceptedCards(cards);
      generateItinerary(cards);
    } catch {
      setError("Aiyoh, card data corrupted lah. Go back and try again.");
    }
  }, []);

  async function generateItinerary(cards: Card[]) {
    setLoading(true);
    setError(null);

    const destination = sessionStorage.getItem("mybuddy_destination") ?? "Malaysia";
    const arrivalTime = sessionStorage.getItem("mybuddy_arrival_time") ?? "09:00";
    const departureTime = sessionStorage.getItem("mybuddy_departure_time") ?? "18:00";
    const tripDays = parseInt(sessionStorage.getItem("mybuddy_trip_days") ?? "1", 10);
    const startDate = sessionStorage.getItem("mybuddy_trip_start") ?? undefined;
    const answersRaw = sessionStorage.getItem("mybuddy_answers");
    const answers = answersRaw ? JSON.parse(answersRaw) : undefined;

    try {
      const res = await fetch("/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedCards: cards,
          arrivalTime,
          departureTime,
          destination,
          tripDays,
          startDate,
          answers,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Aiyoh, itinerary generation failed lah. Jom try again?");
        setLoading(false);
        return;
      }

      setItinerary(data.itinerary);
      setLoading(false);
    } catch {
      setError("Aiyoh, network error lah. Check your connection and try again boleh?");
      setLoading(false);
    }
  }

  if (error && !itinerary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <div className="w-full max-w-sm">
          <ErrorMessage message={error} onRetry={() => router.push("/")} />
        </div>
      </div>
    );
  }

  if (loading || !itinerary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <LoadingIndicator />
      </div>
    );
  }

  const routeIndex = itinerary.routes.findIndex((r) => r.route === selectedRoute);
  const currentRoute = itinerary.routes[routeIndex >= 0 ? routeIndex : 0];
  const days = currentRoute.days;
  const currentDay = days[selectedDay] ?? days[0];

  return (
    <div className="flex flex-col min-h-screen px-5 py-6">
      <div className="w-full max-w-sm mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-zinc-800">Your Itinerary 🗓️</h1>
          <p className="text-xs text-zinc-500">
            {itinerary.destination} • {formatTripDates()} • {itinerary.tripDays} day{itinerary.tripDays > 1 ? "s" : ""}
          </p>
        </div>

        {/* Route tabs */}
        <RouteTabBar selected={selectedRoute} onChange={(r) => { setSelectedRoute(r); setSelectedDay(0); }} />

        {/* Day selector (only show if multi-day) */}
        {days.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {days.map((day, i) => (
              <button
                key={i}
                onClick={() => setSelectedDay(i)}
                className={`shrink-0 min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  selectedDay === i
                    ? "bg-amber-500 text-white shadow"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <div>Day {day.day}</div>
                {day.date && <div className="text-[10px] opacity-80">{formatDate(day.date)}</div>}
              </button>
            ))}
          </div>
        )}

        {/* Warning */}
        {currentRoute.warningMessage && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            ⚠️ {currentRoute.warningMessage}
          </div>
        )}

        {/* Dropped cards */}
        {currentRoute.droppedCards.length > 0 && !currentRoute.warningMessage && (
          <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-sm text-zinc-600">
            Removed due to time constraints: {currentRoute.droppedCards.join(", ")}
          </div>
        )}

        {/* Day schedule */}
        {currentDay && (
          <div className="space-y-2">
            {days.length > 1 && (
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-700">
                  Day {currentDay.day} {currentDay.date ? `— ${formatDate(currentDay.date)}` : ""}
                </h3>
                <span className="text-xs text-zinc-400">
                  {currentDay.activities.length} activities • {currentDay.totalDuration}min
                </span>
              </div>
            )}
            <ActivitySchedule activities={currentDay.activities} totalDuration={currentDay.totalDuration} />
          </div>
        )}

        {/* Start over */}
        <button
          onClick={() => router.push("/")}
          className="w-full min-h-[44px] rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 active:scale-95 transition-transform"
        >
          Plan another trip lah! 🔄
        </button>
      </div>
    </div>
  );
}
