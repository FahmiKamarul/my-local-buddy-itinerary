"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import type { Card } from "@/lib/schemas";

interface SwipeCardProps {
  card: Card;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isTop: boolean;
}

const SWIPE_THRESHOLD = 100;

export default function SwipeCard({ card, onSwipeLeft, onSwipeRight, isTop }: SwipeCardProps) {
  const x = useMotionValue(0);

  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const greenOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const redOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x > SWIPE_THRESHOLD) {
      onSwipeRight();
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      onSwipeLeft();
    }
  }

  const isActivity = card.type === "activity";

  return (
    <motion.div
      style={{ x, rotate, position: "absolute", width: "100%", touchAction: "none" }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: "grabbing" }}
      animate={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 12 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="select-none"
    >
      <div className="relative rounded-3xl bg-surface shadow-xl shadow-primary/10 overflow-hidden min-h-[420px] flex flex-col border border-primary-light/20">
        {/* Coloured header strip */}
        <div className={`h-2 w-full ${isActivity ? "bg-accent" : "bg-primary-light"}`} />

        {/* Card body */}
        <div className="flex flex-col flex-1 p-6 gap-4">
          {/* Type badge */}
          <span className={`self-start text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full ${
            isActivity ? "bg-accent/10 text-accent" : "bg-primary-light/20 text-primary"
          }`}>
            {isActivity ? "Activity" : "Quick Question"}
          </span>

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground leading-snug">{card.title}</h2>

          {/* Description */}
          <p className="text-sm text-muted leading-relaxed flex-1">{card.description}</p>

          {/* Activity metadata */}
          {isActivity && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-primary-light/20">
              <div className="text-center">
                <p className="text-xs text-muted uppercase tracking-wide">Duration</p>
                <p className="text-sm font-semibold text-foreground">{card.baseDuration}m</p>
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

        {/* Swipe overlays */}
        <motion.div
          style={{ opacity: greenOpacity }}
          className="absolute inset-0 bg-green-400/30 rounded-3xl flex items-center justify-center pointer-events-none"
        >
          <span className="text-5xl font-black text-green-600 rotate-[-20deg] border-4 border-green-600 px-4 py-1 rounded-xl">
            BOLEH!
          </span>
        </motion.div>

        <motion.div
          style={{ opacity: redOpacity }}
          className="absolute inset-0 bg-red-400/30 rounded-3xl flex items-center justify-center pointer-events-none"
        >
          <span className="text-5xl font-black text-red-600 rotate-[20deg] border-4 border-red-600 px-4 py-1 rounded-xl">
            PASS
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
