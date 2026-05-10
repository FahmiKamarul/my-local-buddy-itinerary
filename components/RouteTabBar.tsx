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
    <div className="flex rounded-2xl bg-surface-alt p-1 gap-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all ${
            selected === tab.id
              ? "bg-surface shadow-md text-accent"
              : "text-muted hover:text-primary"
          }`}
        >
          <span className="text-lg">{tab.emoji}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
