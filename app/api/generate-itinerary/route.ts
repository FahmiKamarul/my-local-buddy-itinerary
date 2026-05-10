import { NextResponse } from "next/server";
import { validateTimeWindow, parseHHMM } from "@/lib/time-utils";
import {
  calculateBufferedDuration,
  dropCardsToFitWindow,
  assignStartEndTimes,
  orderOptimized,
  orderMakanFocused,
  orderSantai,
  type ActivityCardWithBuffer,
} from "@/lib/itinerary-engine";
import { ItineraryResultSchema, type ActivityCard, type DaySchedule } from "@/lib/schemas";

/**
 * Distributes activity cards evenly across multiple days.
 * Instead of greedily filling each day, splits cards roughly equally
 * so each day has a balanced schedule.
 */
function distributeCardsAcrossDays(
  cards: ActivityCardWithBuffer[],
  availableMinutesPerDay: number,
  tripDays: number
): ActivityCardWithBuffer[][] {
  if (cards.length === 0) return [];
  if (tripDays <= 1) return [cards];

  // Calculate how many cards per day (roughly equal split)
  const cardsPerDay = Math.ceil(cards.length / tripDays);
  const days: ActivityCardWithBuffer[][] = [];

  for (let day = 0; day < tripDays; day++) {
    const start = day * cardsPerDay;
    const end = Math.min(start + cardsPerDay, cards.length);
    const dayCards = cards.slice(start, end);

    if (dayCards.length > 0) {
      days.push(dayCards);
    }
  }

  return days;
}

/**
 * Adds a date string to each day based on the start date.
 */
function addDatesToSchedule(startDate: string | undefined, dayIndex: number): string | undefined {
  if (!startDate) return undefined;
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayIndex);
  return date.toISOString().split("T")[0];
}

/**
 * Generates a multi-day itinerary using the local engine.
 */
function generateMultiDayItinerary(
  activityCards: ActivityCard[],
  arrivalTime: string,
  departureTime: string,
  destination: string,
  tripDays: number,
  startDate?: string,
) {
  const availableMinutesPerDay = parseHHMM(departureTime) - parseHHMM(arrivalTime);

  // --- Optimized Route ---
  const optimizedBuffered = activityCards.map((c) => ({
    ...c,
    bufferedDuration: calculateBufferedDuration(c.baseDuration, 1.25),
  }));
  const optimizedOrdered = orderOptimized(optimizedBuffered, destination);
  const optimizedDayGroups = distributeCardsAcrossDays(optimizedOrdered, availableMinutesPerDay, tripDays);
  const optimizedDays: DaySchedule[] = optimizedDayGroups.map((dayCards, i) => ({
    day: i + 1,
    date: addDatesToSchedule(startDate, i),
    activities: assignStartEndTimes(dayCards, arrivalTime, 0),
    totalDuration: dayCards.reduce((s, c) => s + c.bufferedDuration, 0),
  }));

  // --- Makan-Focused Route ---
  const makanBuffered = activityCards.map((c) => ({
    ...c,
    bufferedDuration: calculateBufferedDuration(c.baseDuration, 1.25),
  }));
  const makanOrdered = orderMakanFocused(makanBuffered, arrivalTime, departureTime);
  const makanDayGroups = distributeCardsAcrossDays(makanOrdered, availableMinutesPerDay, tripDays);
  const makanDays: DaySchedule[] = makanDayGroups.map((dayCards, i) => ({
    day: i + 1,
    date: addDatesToSchedule(startDate, i),
    activities: assignStartEndTimes(dayCards, arrivalTime, 0),
    totalDuration: dayCards.reduce((s, c) => s + c.bufferedDuration, 0),
  }));

  // --- Santai Route ---
  const santaiResult = orderSantai(activityCards, availableMinutesPerDay * tripDays);
  // For Santai, account for rest intervals in daily capacity
  const santaiMinutesPerDay = availableMinutesPerDay; // rest intervals are within the day
  const santaiDayGroups = distributeCardsAcrossDays(santaiResult.orderedCards, santaiMinutesPerDay, tripDays);
  const santaiDays: DaySchedule[] = santaiDayGroups.map((dayCards, i) => ({
    day: i + 1,
    date: addDatesToSchedule(startDate, i),
    activities: assignStartEndTimes(dayCards, arrivalTime, 15),
    totalDuration: dayCards.reduce((s, c) => s + c.bufferedDuration, 0),
  }));

  // Collect dropped cards (cards that didn't fit in any route)
  const allKeptOptimized = new Set(optimizedDayGroups.flat().map((c) => c.title));
  const droppedOptimized = activityCards.filter((c) => !allKeptOptimized.has(c.title)).map((c) => c.title);

  return {
    destination,
    arrivalTime,
    departureTime,
    tripDays,
    startDate,
    routes: [
      {
        route: "optimized" as const,
        days: optimizedDays,
        droppedCards: droppedOptimized,
      },
      {
        route: "makan-focused" as const,
        days: makanDays,
        droppedCards: [] as string[],
      },
      {
        route: "santai" as const,
        days: santaiDays,
        droppedCards: santaiResult.droppedCards.map((c) => c.title),
        warningMessage: santaiResult.warning,
      },
    ],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { acceptedCards, arrivalTime, departureTime, destination, tripDays = 1, startDate } = body;

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

    // Generate multi-day itinerary
    const itinerary = generateMultiDayItinerary(
      activityCards,
      arrivalTime,
      departureTime,
      destination,
      tripDays,
      startDate
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

    return NextResponse.json({ itinerary: parsed.data });
  } catch (err) {
    console.error("Generate itinerary error:", err);
    return NextResponse.json(
      { error: "Aiyoh, something went wrong generating your itinerary lah. Jom try again?" },
      { status: 500 }
    );
  }
}
