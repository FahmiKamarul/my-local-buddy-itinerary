"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TimeWindowInput from "@/components/TimeWindowInput";
import RouteTabBar from "@/components/RouteTabBar";
import ActivitySchedule from "@/components/ActivitySchedule";
import LoadingIndicator from "@/components/LoadingIndicator";
import ErrorMessage from "@/components/ErrorMessage";
import type { Card, ItineraryResult } from "@/lib/schemas";

type RouteType = "optimized" | "makan-focused" | "santai";

export default function ItineraryPage() {
  const router = useRouter();
  const [acceptedCards, setAcceptedCards] = useState<Card[] | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteType>("optimized");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTimeInput, setShowTimeInput] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem("mybuddy_accepted");
    if (stored) {
      try {
        setAcceptedCards(JSON.parse(stored));
      } catch {
        setError("Aiyoh, card data corrupted lah. Go back and try again.");
      }
    } else {
      setError("No accepted cards found lah. Go back and swipe some cards first.");
    }
  }, []);

  async function handleGenerateItinerary(arrivalTime: string, departureTime: string, date: string) {
    if (!acceptedCards) return;

    setShowTimeInput(false);
    setLoading(true);
    setError(null);

    const destination = sessionStorage.getItem("mybuddy_destination") ?? "Malaysia";

    // Store the date for display
    sessionStorage.setItem("mybuddy_trip_date", date);

    try {
      const res = await fetch("/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedCards,
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

  // Loading cards
  if (!acceptedCards) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <LoadingIndicator message="Loading your selections..." />
      </div>
    );
  }

  // Time window input
  if (showTimeInput) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Set Your Time ⏰</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              You picked {acceptedCards.length} cards — now set your day window
            </p>
          </div>
          <TimeWindowInput onConfirm={handleGenerateItinerary} loading={loading} />
        </div>
      </div>
    );
  }

  // Loading itinerary
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <LoadingIndicator />
      </div>
    );
  }

  // Itinerary display
  if (itinerary) {
    const routeIndex = itinerary.routes.findIndex((r) => r.route === selectedRoute);
    const currentRoute = itinerary.routes[routeIndex >= 0 ? routeIndex : 0];

    return (
      <div className="flex flex-col min-h-screen px-5 py-6">
        <div className="w-full max-w-sm mx-auto space-y-5">
          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Your Itinerary 🗓️</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {itinerary.destination} • {sessionStorage.getItem("mybuddy_trip_date") ?? ""} • {itinerary.arrivalTime} – {itinerary.departureTime}
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

  return null;
}
