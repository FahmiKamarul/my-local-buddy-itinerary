"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RouteTabBar from "@/components/RouteTabBar";
import ActivitySchedule from "@/components/ActivitySchedule";
import LoadingIndicator from "@/components/LoadingIndicator";
import ErrorMessage from "@/components/ErrorMessage";
import type { Card, ItineraryResult } from "@/lib/schemas";

type RouteType = "optimized" | "makan-focused" | "santai";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
      // Auto-generate itinerary on mount
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

    try {
      const res = await fetch("/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedCards: cards,
          arrivalTime,
          departureTime,
          destination,
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

  // Error state
  if (error && !itinerary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <div className="w-full max-w-sm">
          <ErrorMessage message={error} onRetry={() => router.push("/")} />
        </div>
      </div>
    );
  }

  // Loading
  if (loading || !itinerary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <LoadingIndicator />
      </div>
    );
  }

  // Itinerary display
  const routeIndex = itinerary.routes.findIndex((r) => r.route === selectedRoute);
  const currentRoute = itinerary.routes[routeIndex >= 0 ? routeIndex : 0];

  return (
    <div className="flex flex-col min-h-screen px-5 py-6">
      <div className="w-full max-w-sm mx-auto space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Your Itinerary 🗓️</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {itinerary.destination} • {formatTripDates()} • {itinerary.arrivalTime} – {itinerary.departureTime}
          </p>
        </div>

        {/* Route tabs */}
        <RouteTabBar selected={selectedRoute} onChange={setSelectedRoute} />

        {/* Schedule */}
        <ActivitySchedule route={currentRoute} />

        {/* Start over */}
        <button
          onClick={() => router.push("/")}
          className="w-full min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-600 dark:text-zinc-300 active:scale-95 transition-transform"
        >
          Plan another trip lah! 🔄
        </button>
      </div>
    </div>
  );
}
