"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);

  const cards = deck.cards;
  const total = cards.length;
  const isDone = currentIndex >= total;

  function advance(card: Card, direction: "left" | "right") {
    setExiting(direction);

    const newAccepted = direction === "right" ? [...acceptedCards, card] : acceptedCards;
    const newAnswers = card.type === "question"
      ? { ...answers, [card.title]: direction === "right" ? "Yes" : "No" as "Yes" | "No" }
      : answers;

    setTimeout(() => {
      setExiting(null);
      setAcceptedCards(newAccepted);
      setAnswers(newAnswers);
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);

      if (nextIndex >= total) {
        // End of deck — trigger completion after 500ms
        setTimeout(() => onComplete(newAccepted, newAnswers), 500);
      }
    }, 300);
  }

  if (isDone) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="text-4xl">🎉</div>
        <p className="text-lg font-semibold text-zinc-800">Habis dah! All done lah.</p>
        <p className="text-sm text-zinc-500">Generating your itinerary now...</p>
      </div>
    );
  }

  const topCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  return (
    <div className="flex flex-col gap-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-300"
            style={{ width: `${(currentIndex / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-zinc-500 shrink-0">{currentIndex + 1} / {total}</span>
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

        {/* Top card */}
        <AnimatePresence>
          {!exiting && (
            <motion.div
              key={`card-${currentIndex}`}
              style={{ position: "absolute", width: "100%" }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{
                x: exiting === "right" ? 400 : -400,
                opacity: 0,
                transition: { duration: 0.3 },
              }}
            >
              <SwipeCard
                card={topCard}
                onSwipeLeft={() => advance(topCard, "left")}
                onSwipeRight={() => advance(topCard, "right")}
                isTop={true}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Button controls */}
      <SwipeControls
        onSwipeLeft={() => advance(topCard, "left")}
        onSwipeRight={() => advance(topCard, "right")}
        disabled={!!exiting}
      />
    </div>
  );
}
