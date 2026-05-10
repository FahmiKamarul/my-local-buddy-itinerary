"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SwipeCardStack from "@/components/SwipeCardStack";
import LoadingIndicator from "@/components/LoadingIndicator";
import ErrorMessage from "@/components/ErrorMessage";
import type { Card, CardDeck } from "@/lib/schemas";

export default function SwipePage() {
  const router = useRouter();
  const [deck, setDeck] = useState<CardDeck | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("mybuddy_deck");
    if (stored) {
      try {
        setDeck(JSON.parse(stored));
      } catch {
        setError("Aiyoh, deck data corrupted lah. Go back and try again.");
      }
    } else {
      setError("No deck found lah. Go back to the home page and enter your destination.");
    }
  }, []);

  function handleComplete(acceptedCards: Card[], answers: Record<string, "Yes" | "No">) {
    if (acceptedCards.length < 2) {
      // Not enough cards — show restart message
      setError("Eh, swipe a few more lah! We need at least 2 cards to plan your trip.");
      return;
    }

    // Store accepted cards and navigate to itinerary page
    sessionStorage.setItem("mybuddy_accepted", JSON.stringify(acceptedCards));
    sessionStorage.setItem("mybuddy_answers", JSON.stringify(answers));
    router.push("/itinerary");
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <div className="w-full max-w-sm">
          <ErrorMessage message={error} onRetry={() => router.push("/")} />
        </div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <LoadingIndicator message="Loading your cards..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen px-5 py-6">
      <div className="w-full max-w-sm mx-auto space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Swipe Your Picks 👆</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Right = Yes, Left = Nope</p>
        </div>

        {/* Card stack */}
        <SwipeCardStack deck={deck} onComplete={handleComplete} />
      </div>
    </div>
  );
}
