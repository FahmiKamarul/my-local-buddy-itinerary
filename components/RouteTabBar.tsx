"use client";

type RouteType = "optimized" | "makan-focused" | "santai";

interface RouteTabBarProps {
  selected: RouteType;
  onChange: (route: RouteType) => void;
}

const TABS: { id: RouteType; label: string; emoji: string }[] = [
  { id: "optimized", label: "Optimized", emoji: "⚡" },
  { id: "makan-focused", label: "Makan", emoji: "🍜" },
  { id: "santai", label: "Santai", emoji: "😌" },
];

export default function RouteTabBar({ selected, onChange }: RouteTabBarProps) {
  return (
    <div className="flex rounded-2xl bg-zinc-100 dark:bg-zinc-800 p-1 gap-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all ${
            selected === tab.id
              ? "bg-white dark:bg-zinc-700 shadow text-amber-700 dark:text-amber-400"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          }`}
        >
          <span className="text-lg">{tab.emoji}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
