"use client";

interface SwipeControlsProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  disabled?: boolean;
}

export default function SwipeControls({ onSwipeLeft, onSwipeRight, disabled }: SwipeControlsProps) {
  return (
    <div className="flex items-center justify-center gap-8 pt-2">
      {/* Skip / Nope */}
      <button
        onClick={onSwipeLeft}
        disabled={disabled}
        aria-label="Skip this card"
        className="min-w-[56px] min-h-[56px] flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border-2 border-red-300 dark:border-red-500 text-red-500 text-2xl shadow-md active:scale-90 transition-transform disabled:opacity-40"
      >
        ✕
      </button>

      {/* Accept / Yes */}
      <button
        onClick={onSwipeRight}
        disabled={disabled}
        aria-label="Accept this card"
        className="min-w-[56px] min-h-[56px] flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border-2 border-green-300 dark:border-green-500 text-green-500 text-2xl shadow-md active:scale-90 transition-transform disabled:opacity-40"
      >
        ♥
      </button>
    </div>
  );
}
