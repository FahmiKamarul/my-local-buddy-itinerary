import { NextResponse } from "next/server";
import { validateTimeWindow, parseHHMM } from "@/lib/time-utils";
import {
  calculateBufferedDuration,
  assignStartEndTimes,
  orderOptimized,
  orderMakanFocused,
  orderSantai,
} from "@/lib/itinerary-engine";
import { ItineraryResultSchema, type ActivityCard } from "@/lib/schemas";

/**
 * Splits activity cards evenly across trip days.
 * High priority cards go to earlier days, low priority to later days.
 */
function splitCardsAcrossDays(cards: ActivityCard[], tripDays: number): ActivityCard[][] {
  if (tripDays <= 1) return [cards];

  // Sort by priority: High first, then Medium, then Low
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  const sorted = [...cards].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const days: ActivityCard[][] = Array.from({ length: tripDays }, () => []);
  sorted.forEach((card, i) => {
    days[i % tripDays].push(card);
  });

  return days;
}

/**
 * Generates a single day's itinerary for a given route type.
 */
function generateDayItinerary(
  cards: ActivityCard[],
  arrivalTime: string,
  departureTime: string,
  destination: string,
  routeType: "optimized" | "makan-focused" | "santai",
  dayNumber: number
) {
  const availableMinutes = parseHHMM(departureTime) - parseHHMM(arrivalTime);
  const bufferMultiplier = routeType === "santai" ? 1.3 : 1.25;
  const restInterval = routeType === "santai" ? 15 : 0;

  // Apply buffers
  const bufferedCards = cards.map((c) => ({
    ...c,
    bufferedDuration: calculateBufferedDuration(c.baseDuration, bufferMultiplier),
  }));

  // Drop cards that don't fit (keep high priority)
  let keptCards = bufferedCards;
  let droppedCards: typeof bufferedCards = [];
  let totalDuration = keptCards.reduce((s, c) => s + c.bufferedDuration, 0);

  if (totalDuration > availableMinutes) {
    // Sort by priority (Low dropped first)
    const byPriority = [...bufferedCards].sort((a, b) => {
      const order = { High: 0, Medium: 1, Low: 2 };
      return order[a.priority] - order[b.priority];
    });

    keptCards = [];
    droppedCards = [];
    let remaining = availableMinutes;

    for (const card of byPriority) {
      if (remaining >= card.bufferedDuration) {
        keptCards.push(card);
        remaining -= card.bufferedDuration;
      } else {
        droppedCards.push(card);
      }
    }
    totalDuration = keptCards.reduce((s, c) => s + c.bufferedDuration, 0);
  }

  // Order based on route type
  let orderedCards;
  if (routeType === "makan-focused") {
    orderedCards = orderMakanFocused(keptCards, arrivalTime, departureTime);
  } else if (routeType === "santai") {
    orderedCards = orderSantai(cards, availableMinutes).orderedCards.map((c) => ({
      ...c,
      bufferedDuration: calculateBufferedDuration(c.baseDuration, 1.3),
    }));
  } else {
    orderedCards = orderOptimized(keptCards, destination);
  }

  const activities = assignStartEndTimes(orderedCards, arrivalTime, restInterval);

  return {
    dayNumber,
    activities,
    totalDuration: Math.min(activities.reduce((s, a) => s + a.bufferedDuration, 0), 1440),
    droppedCards: droppedCards.map((c) => c.title),
  };
}

/**
 * Generates multi-day itinerary using the local engine.
 * Spreads activities across all trip days.
 */
function generateMultiDayItinerary(
  activityCards: ActivityCard[],
  arrivalTime: string,
  departureTime: string,
  destination: string,
  tripDays: number
) {
  const daysOfCards = splitCardsAcrossDays(activityCards, tripDays);

  // Generate each route type across all days
  const routeTypes: Array<"optimized" | "makan-focused" | "santai"> = ["optimized", "makan-focused", "santai"];

  const routes = routeTypes.map((routeType) => {
    const allActivities: ReturnType<typeof assignStartEndTimes> = [];
    const allDropped: string[] = [];
    let totalDuration = 0;

    daysOfCards.forEach((dayCards, dayIdx) => {
      if (dayCards.length === 0) return;

      const dayResult = generateDayItinerary(
        dayCards,
        arrivalTime,
        departureTime,
        destination,
        routeType,
        dayIdx + 1
      );

      // Prefix activities with day label
      const dayActivities = dayResult.activities.map((a) => ({
        ...a,
        cardTitle: tripDays > 1 ? `[Day ${dayIdx + 1}] ${a.cardTitle}` : a.cardTitle,
      }));

      allActivities.push(...dayActivities);
      allDropped.push(...dayResult.droppedCards);
      totalDuration += dayResult.totalDuration;
    });

    return {
      route: routeType,
      activities: allActivities.length > 0 ? allActivities : [{
        cardTitle: "Free day",
        location: destination,
        price: "Free",
        priority: "Low" as const,
        startTime: arrivalTime,
        endTime: departureTime,
        bufferedDuration: parseHHMM(departureTime) - parseHHMM(arrivalTime),
        isRestInterval: true,
      }],
      totalDuration: Math.min(totalDuration, 1440 * tripDays),
      droppedCards: allDropped,
      warningMessage: allDropped.length > 0
        ? `Dropped ${allDropped.length} activity${allDropped.length > 1 ? "s" : ""} that didn't fit the time window.`
        : undefined,
    };
  });

  return {
    destination,
    arrivalTime,
    departureTime,
    routes,
  };
}

export async function POST(request: Request) {
  const startTime = performance.now();
  try {
    const body = await request.json();
    const { acceptedCards, arrivalTime, departureTime, destination, tripDays = 1 } = body;

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

    // Generate multi-day itinerary using local engine (fast, no AI needed)
    const itinerary = generateMultiDayItinerary(
      activityCards,
      arrivalTime,
      departureTime,
      destination,
      Math.max(1, Math.min(14, tripDays))
    );

    // Validate output
    const parsed = ItineraryResultSchema.safeParse(itinerary);
    if (!parsed.success) {
      console.error("Itinerary schema validation failed:", parsed.error.issues);
      return NextResponse.json(
        { error: "Aiyoh, itinerary generation failed validation lah. Jom try again?" },
        { status: 500 }
      );
    }

    console.log(`[generate-itinerary] Done in ${((performance.now() - startTime) / 1000).toFixed(1)}s — ${activityCards.length} activities across ${tripDays} day(s)`);
    return NextResponse.json({ itinerary: parsed.data });
  } catch (err) {
    console.error("Generate itinerary error:", err);
    return NextResponse.json(
      { error: "Aiyoh, something went wrong generating your itinerary lah. Jom try again?" },
      { status: 500 }
    );
  }
}
