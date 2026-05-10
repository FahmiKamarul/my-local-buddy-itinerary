import { NextResponse } from "next/server";
import { validateTimeWindow, parseHHMM } from "@/lib/time-utils";
import {
  calculateBufferedDuration,
  dropCardsToFitWindow,
  assignStartEndTimes,
  orderOptimized,
  orderMakanFocused,
  orderSantai,
} from "@/lib/itinerary-engine";
import { ItineraryResultSchema, type ActivityCard } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { acceptedCards, arrivalTime, departureTime, destination } = body;

    // Validate time window
    const timeResult = validateTimeWindow(arrivalTime, departureTime);
    if (!timeResult.valid) {
      return NextResponse.json({ error: timeResult.error }, { status: 400 });
    }

    // Filter to activity cards only
    const activityCards: ActivityCard[] = (acceptedCards ?? []).filter(
      (c: { type: string }) => c.type === "activity"
    );

    if (activityCards.length < 1) {
      return NextResponse.json(
        { error: "Aiyoh, no activity cards found lah! Go back and swipe some activities." },
        { status: 400 }
      );
    }

    const availableMinutes = parseHHMM(departureTime) - parseHHMM(arrivalTime);

    // --- Optimized Route ---
    const optimizedBuffered = activityCards.map((c) => ({
      ...c,
      bufferedDuration: calculateBufferedDuration(c.baseDuration, 1.25),
    }));
    const optimizedDrop = dropCardsToFitWindow(optimizedBuffered, availableMinutes);
    const optimizedOrdered = orderOptimized(optimizedDrop.keptCards, destination);
    const optimizedActivities = assignStartEndTimes(optimizedOrdered, arrivalTime, 0);
    const optimizedTotal = optimizedActivities.reduce((s, a) => s + a.bufferedDuration, 0);

    // --- Makan-Focused Route ---
    const makanBuffered = activityCards.map((c) => ({
      ...c,
      bufferedDuration: calculateBufferedDuration(c.baseDuration, 1.25),
    }));
    const makanDrop = dropCardsToFitWindow(makanBuffered, availableMinutes);
    const makanOrdered = orderMakanFocused(makanDrop.keptCards, arrivalTime, departureTime);
    const makanActivities = assignStartEndTimes(makanOrdered, arrivalTime, 0);
    const makanTotal = makanActivities.reduce((s, a) => s + a.bufferedDuration, 0);

    // --- Santai Route ---
    const santaiResult = orderSantai(activityCards, availableMinutes);
    const santaiActivities = assignStartEndTimes(santaiResult.orderedCards, arrivalTime, 15);
    const santaiTotal = santaiActivities.reduce((s, a) => s + a.bufferedDuration, 0);

    const itinerary = {
      destination: destination ?? "Malaysia",
      arrivalTime,
      departureTime,
      routes: [
        {
          route: "optimized" as const,
          activities: optimizedActivities,
          totalDuration: Math.min(optimizedTotal, 1440),
          droppedCards: optimizedDrop.droppedCards.map((c) => c.title),
          warningMessage: optimizedDrop.warning,
        },
        {
          route: "makan-focused" as const,
          activities: makanActivities,
          totalDuration: Math.min(makanTotal, 1440),
          droppedCards: makanDrop.droppedCards.map((c) => c.title),
          warningMessage: makanDrop.warning,
        },
        {
          route: "santai" as const,
          activities: santaiActivities,
          totalDuration: Math.min(santaiTotal, 1440),
          droppedCards: santaiResult.droppedCards.map((c) => c.title),
          warningMessage: santaiResult.warning,
        },
      ],
    };

    // Validate output
    const parsed = ItineraryResultSchema.safeParse(itinerary);
    if (!parsed.success) {
      console.error("Itinerary schema validation failed:", parsed.error);
      return NextResponse.json(
        { error: "Aiyoh, itinerary generation failed validation lah. Jom try again?" },
        { status: 500 }
      );
    }

    return NextResponse.json({ itinerary: parsed.data });
  } catch (err) {
    console.error("Generate itinerary error:", err);
    return NextResponse.json(
      { error: "Aiyoh, something went wrong generating your itinerary lah. Jom try again?" },
      { status: 500 }
    );
  }
}
