"use client";

import type { RouteItinerary } from "@/lib/schemas";

interface ActivityScheduleProps {
  route: RouteItinerary;
}

const PRIORITY_COLOR: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-green-100 text-green-700",
};

export default function ActivitySchedule({ route }: ActivityScheduleProps) {
  return (
    <div className="space-y-3">
      {/* Warning if cards were dropped */}
      {route.warningMessage && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          ⚠️ {route.warningMessage}
        </div>
      )}

      {/* Dropped cards notice */}
      {route.droppedCards.length > 0 && !route.warningMessage && (
        <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-sm text-zinc-600">
          Removed due to time constraints: {route.droppedCards.join(", ")}
        </div>
      )}

      {/* Activity list */}
      <div className="space-y-2">
        {route.activities.map((activity, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm p-4 flex gap-3"
          >
            {/* Time column */}
            <div className="shrink-0 text-center w-14">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{activity.startTime}</p>
              <div className="my-1 w-px h-4 bg-zinc-200 dark:bg-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400">{activity.endTime}</p>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 leading-snug">{activity.cardTitle}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">📍 {activity.location}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">⏱ {activity.bufferedDuration}m</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">💰 {activity.price}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[activity.priority] ?? "bg-zinc-100 text-zinc-600"}`}>
                  {activity.priority}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="text-right text-xs text-zinc-400 pt-1">
        Total: {route.totalDuration} min
      </div>
    </div>
  );
}
