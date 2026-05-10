"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import type { Card } from "@/lib/schemas";

interface SwipeCardProps {
  card: Card;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isTop: boolean;
  /** Programmatic exit triggered by button press */
  triggerExit?: "left" | "right" | null;
}

const SWIPE_THRESHOLD = 100;
const FLY_OUT_DISTANCE = 500;

export default function SwipeCard({ card, onSwipeLeft, onSwipeRight, isTop, triggerExit }: SwipeCardProps) {
  const x = useMotionValue(0);

  // Separate motion value for button-triggered overlay (independent of x)
  const buttonOverlay = useMotionValue(0);

  const rotate = useTransform(x, [-200, 200], [-18, 18]);

  // Drag-based overlay opacity
  const dragGreenOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const dragRedOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  // Combined: show overlay from drag OR from button trigger
  // For green (right): max of drag-based and button-based (when triggerExit === "right")
  const greenOpacity = useTransform(
    [dragGreenOpacity, buttonOverlay],
    ([drag, btn]: number[]) => triggerExit === "right" ? Math.max(drag, btn) : drag
  );
  const redOpacity = useTransform(
    [dragRedOpacity, buttonOverlay],
    ([drag, btn]: number[]) => triggerExit === "left" ? Math.max(drag, btn) : drag
  );

  // Handle programmatic exit (button press)
  // Show overlay on stationary card for 0.5s, then swipe off
  useEffect(() => {
    if (!triggerExit) return;

    const flyTarget = triggerExit === "right" ? FLY_OUT_DISTANCE : -FLY_OUT_DISTANCE;

    // Step 1: Instantly show the overlay (card stays still)
    animate(buttonOverlay, 1, {
      type: "tween",
      duration: 0.15,
      ease: "easeOut",
      onComplete: () => {
        // Step 2: Hold for 0.5s so user reads the label
        setTimeout(() => {
          // Step 3: Fly off screen
          animate(x, flyTarget, {
            type: "tween",
            duration: 0.35,
            ease: [0.4, 0, 0.2, 1],
            onComplete: () => {
              if (triggerExit === "right") {
                onSwipeRight();
              } else {
                onSwipeLeft();
              }
            },
          });
        }, 500);
      },
    });
  }, [triggerExit]);

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Use velocity to make it feel more natural
    if (offset > SWIPE_THRESHOLD || velocity > 500) {
      animate(x, FLY_OUT_DISTANCE, {
        type: "tween",
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        onComplete: onSwipeRight,
      });
    } else if (offset < -SWIPE_THRESHOLD || velocity < -500) {
      animate(x, -FLY_OUT_DISTANCE, {
        type: "tween",
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        onComplete: onSwipeLeft,
      });
    } else {
      // Snap back
      animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
    }
  }

  const isActivity = card.type === "activity";

  return (
    <motion.div
      style={{ x, rotate, position: "absolute", width: "100%", touchAction: "none" }}
      drag={isTop && !triggerExit ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: "grabbing" }}
      initial={isTop ? { scale: 1, y: 0 } : { scale: 0.95, y: 12 }}
      animate={isTop ? { scale: 1, y: 0 } : { scale: 0.95, y: 12 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="select-none"
    >
      <div className="relative rounded-3xl bg-surface shadow-xl shadow-primary/10 overflow-hidden min-h-[340px] flex flex-col border border-primary-light/20">
        {/* Place photo */}
        {isActivity && card.imageUrl && (
          <div className="relative w-full h-32 overflow-hidden">
            <img
              src={card.imageUrl}
              alt={card.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent" />
          </div>
        )}

        {/* Coloured header strip (only when no image) */}
        {!(isActivity && card.imageUrl) && (
          <div className={`h-2 w-full ${isActivity ? "bg-accent" : "bg-primary-light"}`} />
        )}

        {/* Card body */}
        <div className="flex flex-col flex-1 p-5 gap-3">
          {/* Top row: badge + rating */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
              isActivity ? "bg-accent/10 text-accent" : "bg-primary-light/20 text-primary"
            }`}>
              {isActivity ? card.category || "Activity" : "Quick Question"}
            </span>

            {/* Rating & reviews */}
            {isActivity && card.rating && (
              <span className="text-xs text-muted flex items-center gap-1">
                <span className="text-yellow-500">⭐</span>
                <span className="font-semibold text-foreground">{card.rating}</span>
                {card.reviewCount && (
                  <span>({card.reviewCount >= 1000 ? `${(card.reviewCount / 1000).toFixed(1)}k` : card.reviewCount})</span>
                )}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold text-foreground leading-snug">{card.title}</h2>

          {/* Description */}
          <p className="text-sm text-muted leading-relaxed flex-1">{card.description}</p>

          {/* Activity metadata */}
          {isActivity && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-primary-light/20">
              <div className="text-center">
                <p className="text-xs text-muted uppercase tracking-wide">Duration</p>
                <p className="text-sm font-semibold text-foreground">{card.baseDuration}min</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted uppercase tracking-wide">Price</p>
                <p className="text-sm font-semibold text-foreground">{card.price}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted uppercase tracking-wide">Priority</p>
                <p className={`text-sm font-semibold ${
                  card.priority === "High" ? "text-accent" :
                  card.priority === "Medium" ? "text-primary" : "text-primary-light"
                }`}>{card.priority}</p>
              </div>
            </div>
          )}

          {/* Question hint */}
          {!isActivity && (
            <div className="flex justify-between text-xs text-muted pt-2 border-t border-primary-light/20">
              <span>← Nope / No</span>
              <span>Yes / Boleh →</span>
            </div>
          )}
        </div>

        {/* Swipe overlays — visible during both drag and button-triggered exit */}
        <motion.div
          style={{ opacity: greenOpacity }}
          className="absolute inset-0 bg-green-400/30 rounded-3xl flex items-center justify-center pointer-events-none"
        >
          <span className="text-5xl font-black text-green-600 rotate-[-20deg] border-4 border-green-600 px-4 py-1 rounded-xl">
            YES!
          </span>
        </motion.div>

        <motion.div
          style={{ opacity: redOpacity }}
          className="absolute inset-0 bg-red-400/30 rounded-3xl flex items-center justify-center pointer-events-none"
        >
          <span className="text-5xl font-black text-red-600 rotate-[20deg] border-4 border-red-600 px-4 py-1 rounded-xl">
            NO
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
