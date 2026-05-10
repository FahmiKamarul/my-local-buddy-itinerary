"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SwipeCard from "@/components/SwipeCard";
import SwipeControls from "@/components/SwipeControls";
import LoadingIndicator from "@/components/LoadingIndicator";
import ErrorMessage from "@/components/ErrorMessage";
import type { Card } from "@/lib/schemas";

// Hardcoded preference question cards — shown first before AI generates activities
const QUESTION_CARDS: Card[] = [
  {
    id: "q-family",
    type: "question",
    title: "Is this a family trip?",
    description: "If you're bringing the kids along, we'll suggest family-friendly spots — shiok for everyone lah!",
  },
  {
    id: "q-food",
    type: "question",
    title: "Do you love trying local food?",
    description: "Makan is life! We'll load up on hawker stalls, famous restaurants, and hidden gems — boleh?",
  },
  {
    id: "q-adventure",
    type: "question",
    title: "Are you into outdoor adventures?",
    description: "Hiking, water sports, nature trails — if you like to lepak in nature, we got you covered!",
  },
  {
    id: "q-history",
    type: "question",
    title: "Do you enjoy history & culture?",
    description: "Museums, heritage sites, old temples — santai walks through the past, very ngam for curious minds.",
  },
  {
    id: "q-budget",
    type: "question",
    title: "Are you on a tight budget?",
    description: "No worries lah! Plenty of free and cheap spots that are still shiok — we'll prioritise those.",
  },
  {
    id: "q-nightlife",
    type: "question",
    title: "Interested in nightlife & entertainment?",
    description: "Night markets, bars, live music — lepak after dark can be the best part of the trip lor!",
  },
];

type Phase = "questions" | "generating" | "activities" | "done";

export default function SwipePage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("questions");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "Yes" | "No">>({});
  const [activityCards, setActivityCards] = useState<Card[]>([]);
  const [activityIndex, setActivityIndex] = useState(0);
  const [acceptedCards, setAcceptedCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Check session data exists
  useEffect(() => {
    const dest = sessionStorage.getItem("mybuddy_destination");
    if (!dest) {
      setError("No trip info found lah. Go back to the home page and start again.");
    }
  }, []);

  // Handle question card swipe
  function handleQuestionSwipe(direction: "left" | "right") {
    const card = QUESTION_CARDS[questionIndex];
    const answer = direction === "right" ? "Yes" : "No";

    const newAnswers = { ...answers, [card.title]: answer as "Yes" | "No" };
    setAnswers(newAnswers);

    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);

    // All questions answered — generate activity cards
    if (nextIndex >= QUESTION_CARDS.length) {
      setPhase("generating");
      generateActivityCards(newAnswers);
    }
  }

  // Call AI to generate activity cards based on answers
  async function generateActivityCards(questionAnswers: Record<string, "Yes" | "No">) {
    const destination = sessionStorage.getItem("mybuddy_destination") ?? "";
    const tripDays = parseInt(sessionStorage.getItem("mybuddy_trip_days") ?? "1", 10);

    const preferences = Object.entries(questionAnswers).map(([question, answer]) => ({
      question,
      answer,
    }));

    try {
      const res = await fetch("/api/generate-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          tripDays,
          preferences,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Aiyoh, something went wrong generating activities. Jom try again?");
        return;
      }

      // Filter to only activity cards from the deck
      const activities = data.deck.cards.filter((c: Card) => c.type === "activity");
      setActivityCards(activities);
      setPhase("activities");
    } catch {
      setError("Aiyoh, network error lah. Check your connection and try again boleh?");
    }
  }

  // Handle activity card swipe
  function handleActivitySwipe(direction: "left" | "right") {
    const card = activityCards[activityIndex];

    if (direction === "right") {
      setAcceptedCards((prev) => [...prev, card]);
    }

    const nextIndex = activityIndex + 1;
    setActivityIndex(nextIndex);

    // All activities swiped
    if (nextIndex >= activityCards.length) {
      setPhase("done");
      const finalAccepted = direction === "right" ? [...acceptedCards, card] : acceptedCards;

      if (finalAccepted.length < 2) {
        setError("Eh, swipe right on at least 2 activities lah! We need those to plan your trip.");
        return;
      }

      // Store and navigate
      sessionStorage.setItem("mybuddy_accepted", JSON.stringify(finalAccepted));
      sessionStorage.setItem("mybuddy_answers", JSON.stringify(answers));
      router.push("/itinerary");
    }
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <div className="w-full max-w-sm">
          <ErrorMessage message={error} onRetry={() => router.push("/")} />
        </div>
      </div>
    );
  }

  // Generating activities (loading)
  if (phase === "generating") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <div className="w-full max-w-sm space-y-4">
          <LoadingIndicator message="Generating personalised activities based on your answers..." />
          <div className="text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Your preferences: {Object.entries(answers).filter(([, v]) => v === "Yes").map(([k]) => k.replace(/^(Do you |Are you |Is this |Interested in )/, "").replace(/\?$/, "")).join(", ") || "None selected"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Done — transitioning
  if (phase === "done") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
        <div className="text-center space-y-3">
          <div className="text-4xl">🎉</div>
          <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Habis dah! All done lah.</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Generating your itinerary now...</p>
        </div>
      </div>
    );
  }

  // Determine current card and progress
  const isQuestionPhase = phase === "questions";
  const currentCard = isQuestionPhase ? QUESTION_CARDS[questionIndex] : activityCards[activityIndex];
  const nextCard = isQuestionPhase
    ? QUESTION_CARDS[questionIndex + 1]
    : activityCards[activityIndex + 1];
  const total = isQuestionPhase ? QUESTION_CARDS.length : activityCards.length;
  const currentIdx = isQuestionPhase ? questionIndex : activityIndex;

  if (!currentCard) return null;

  return (
    <div className="flex flex-col min-h-screen px-5 py-6">
      <div className="w-full max-w-sm mx-auto space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
            {isQuestionPhase ? "Quick Questions 💬" : "Pick Your Activities 👆"}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isQuestionPhase ? "Swipe right = Yes, left = No" : "Right = Want it, Left = Skip"}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isQuestionPhase ? "bg-sky-400" : "bg-amber-400"}`}
              style={{ width: `${(currentIdx / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
            {currentIdx + 1} / {total}
          </span>
        </div>

        {/* Phase indicator */}
        {!isQuestionPhase && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-medium">
              ✓ {acceptedCards.length} accepted
            </span>
          </div>
        )}

        {/* Card stack */}
        <div className="relative" style={{ height: 460 }}>
          {nextCard && (
            <SwipeCard
              key={`next-${isQuestionPhase ? questionIndex + 1 : activityIndex + 1}`}
              card={nextCard}
              onSwipeLeft={() => {}}
              onSwipeRight={() => {}}
              isTop={false}
            />
          )}
          <SwipeCard
            key={`top-${isQuestionPhase ? questionIndex : activityIndex}`}
            card={currentCard}
            onSwipeLeft={() => isQuestionPhase ? handleQuestionSwipe("left") : handleActivitySwipe("left")}
            onSwipeRight={() => isQuestionPhase ? handleQuestionSwipe("right") : handleActivitySwipe("right")}
            isTop={true}
          />
        </div>

        {/* Controls */}
        <SwipeControls
          onSwipeLeft={() => isQuestionPhase ? handleQuestionSwipe("left") : handleActivitySwipe("left")}
          onSwipeRight={() => isQuestionPhase ? handleQuestionSwipe("right") : handleActivitySwipe("right")}
        />
      </div>
    </div>
  );
}
