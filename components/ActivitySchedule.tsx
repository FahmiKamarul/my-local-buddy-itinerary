"use client";

import type { RouteItinerary } from "@/lib/schemas";

interface ActivityScheduleProps {
  route: RouteItinerary;
}

const PRIORITY_COLOR: Record<string, string> = {
  High: "bg-accent/15 text-accent",
  Medium: "bg-primary-light/20 text-primary",
  Low: "bg-primary-light/10 text-primary-light",
};

export default function ActivitySchedule({ route }: ActivityScheduleProps) {
  return (
    <div className="space-y-3">
      {/* Warning if cards were dropped */}
      {route.warningMessage && (
        <div className="rounded-xl bg-accent/10 border border-accent/30 p-3 text-sm text-accent">
          ⚠️ {route.warningMessage}
        </div>
      )}

      {/* Dropped cards notice */}
      {route.droppedCards.length > 0 && !route.warningMessage && (
        <div className="rounded-xl bg-surface-alt border border-primary-light/20 p-3 text-sm text-muted">
          Removed due to time constraints: {route.droppedCards.join(", ")}
        </div>
      )}

      {/* Activity list */}
      <div className="space-y-2">
        {route.activities.map((activity, i) => (
          <div
            key={i}
            className="rounded-2xl bg-surface border border-primary-light/15 shadow-sm p-4 flex gap-3"
          >
            {/* Time column */}
            <div className="shrink-0 text-center w-14">
              <p className="text-xs font-bold text-accent">{activity.startTime}</p>
              <div className="my-1 w-px h-4 bg-primary-light/30 mx-auto" />
              <p className="text-xs text-muted">{activity.endTime}</p>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-semibold text-sm text-foreground leading-snug">{activity.cardTitle}</p>
              <p className="text-xs text-muted truncate">📍 {activity.location}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted">⏱ {activity.bufferedDuration}m</span>
                <span className="text-xs text-muted">💰 {activity.price}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[activity.priority] ?? "bg-surface-alt text-muted"}`}>
                  {activity.priority}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="text-right text-xs text-muted pt-1">
        Total: {route.totalDuration} min
      </div>
    </div>
  );
}
