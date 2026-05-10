"use client";

import { useState, useCallback } from "react";
import SwipeCard from "./SwipeCard";
import SwipeControls from "./SwipeControls";
import type { Card, CardDeck } from "@/lib/schemas";

interface SwipeCardStackProps {
  deck: CardDeck;
  onComplete: (acceptedCards: Card[], answers: Record<string, "Yes" | "No">) => void;
}

export default function SwipeCardStack({ deck, onComplete }: SwipeCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [acceptedCards, setAcceptedCards] = useState<Card[]>([]);
  const [answers, setAnswers] = useState<Record<string, "Yes" | "No">>({});
  const [triggerExit, setTriggerExit] = useState<"left" | "right" | null>(null);
  const [animating, setAnimating] = useState(false);

  const cards = deck.cards;
  const total = cards.length;
  const isDone = currentIndex >= total;

  // Called when the card finishes its fly-out animation (from drag or button)
  const handleCardGone = useCallback((direction: "left" | "right") => {
    const card = cards[currentIndex];
    const newAccepted = direction === "right" ? [...acceptedCards, card] : acceptedCards;
    const newAnswers = card.type === "question"
      ? { ...answers, [card.title]: direction === "right" ? "Yes" : "No" as "Yes" | "No" }
      : answers;

    setAcceptedCards(newAccepted);
    setAnswers(newAnswers);
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setTriggerExit(null);
    setAnimating(false);

    if (nextIndex >= total) {
      setTimeout(() => onComplete(newAccepted, newAnswers), 500);
    }
  }, [currentIndex, acceptedCards, answers, cards, total, onComplete]);

  // Button press triggers programmatic exit
  function handleButtonPress(direction: "left" | "right") {
    if (animating || isDone) return;
    setAnimating(true);
    setTriggerExit(direction);
  }

  if (isDone) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <span className="text-3xl">🎉</span>
        </div>
        <p className="text-lg font-semibold text-primary">Habis dah! All done lah.</p>
        <p className="text-sm text-muted">Generating your itinerary now...</p>
      </div>
    );
  }

  const topCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  return (
    <div className="flex flex-col gap-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-surface-alt rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${(currentIndex / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted shrink-0">{currentIndex + 1} / {total}</span>
      </div>

      {/* Card stack */}
      <div className="relative" style={{ height: 460 }}>
        {/* Background card (next) */}
        {nextCard && (
          <SwipeCard
            key={`card-${currentIndex + 1}`}
            card={nextCard}
            onSwipeLeft={() => {}}
            onSwipeRight={() => {}}
            isTop={false}
          />
        )}

        {/* Top card — handles its own animation */}
        <SwipeCard
          key={`card-${currentIndex}`}
          card={topCard}
          onSwipeLeft={() => handleCardGone("left")}
          onSwipeRight={() => handleCardGone("right")}
          isTop={true}
          triggerExit={triggerExit}
        />
      </div>

      {/* Button controls */}
      <SwipeControls
        onSwipeLeft={() => handleButtonPress("left")}
        onSwipeRight={() => handleButtonPress("right")}
        disabled={animating}
      />
    </div>
  );
}
