"use client";

import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
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

  // Rotate card slightly as it's dragged
  const rotate = useTransform(x, [-200, 200], [-18, 18]);

  // Green overlay opacity on right drag
  const greenOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  // Red overlay opacity on left drag
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
      <div className="relative rounded-3xl bg-white dark:bg-zinc-800 shadow-xl overflow-hidden min-h-[420px] flex flex-col">
        {/* Coloured header strip */}
        <div className={`h-2 w-full ${isActivity ? "bg-amber-400" : "bg-sky-400"}`} />

        {/* Card body */}
        <div className="flex flex-col flex-1 p-6 gap-4">
          {/* Type badge */}
          <span className={`self-start text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full ${
            isActivity ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
          }`}>
            {isActivity ? "Activity" : "Quick Question"}
          </span>

          {/* Title */}
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-snug">{card.title}</h2>

          {/* Description */}
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed flex-1">{card.description}</p>

          {/* Activity metadata */}
          {isActivity && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-700">
              <div className="text-center">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Duration</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{card.baseDuration}m</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Price</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{card.price}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Priority</p>
                <p className={`text-sm font-semibold ${
                  card.priority === "High" ? "text-red-600 dark:text-red-400" :
                  card.priority === "Medium" ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                }`}>{card.priority}</p>
              </div>
            </div>
          )}

          {/* Question hint */}
          {!isActivity && (
            <div className="flex justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-100">
              <span>← Nope / No</span>
              <span>Yes / Boleh →</span>
            </div>
          )}
        </div>

        {/* Swipe overlays — zero-latency via useTransform */}
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
