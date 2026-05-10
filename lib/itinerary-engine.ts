/**
 * Itinerary Engine for MY Buddy Itinerary Planner.
 * Implements deterministic calculation logic for Human Error Buffers,
 * priority-based card dropping, time assignment, and route ordering.
 */

import type { ActivityCard, ScheduledActivity } from './schemas';
import { addMinutes, parseHHMM } from './time-utils';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

/**
 * An ActivityCard with a pre-computed bufferedDuration attached.
 * The caller is responsible for computing bufferedDuration before passing
 * cards into dropCardsToFitWindow.
 */
export interface ActivityCardWithBuffer extends ActivityCard {
  bufferedDuration: number;
}

/**
 * Return value of dropCardsToFitWindow.
 */
export interface DropResult {
  keptCards: ActivityCardWithBuffer[];
  droppedCards: ActivityCardWithBuffer[];
  warning?: string;
}

// ---------------------------------------------------------------------------
// calculateBufferedDuration
// ---------------------------------------------------------------------------

/**
 * Applies a Human Error Buffer multiplier to a base activity duration and
 * rounds the result up to the nearest 5 minutes.
 *
 * Formula: `Math.ceil((baseDuration * multiplier) / 5) * 5`
 *
 * - Optimized / Makan-Focused routes use `multiplier = 1.25`
 * - Santai route uses `multiplier = 1.30`
 *
 * @param baseDuration - Estimated activity duration in minutes (positive integer, 1–720)
 * @param multiplier   - Buffer multiplier, e.g. 1.25 or 1.30
 * @returns Buffered duration rounded up to the nearest 5 minutes
 *
 * @example
 * calculateBufferedDuration(60, 1.25) // → 75   (75 / 5 = 15.0, ceil = 15, × 5 = 75)
 * calculateBufferedDuration(61, 1.25) // → 80   (76.25 / 5 = 15.25, ceil = 16, × 5 = 80)
 * calculateBufferedDuration(60, 1.30) // → 80   (78 / 5 = 15.6, ceil = 16, × 5 = 80)
 *
 * Validates: Requirements 4.2, 5.4
 */
export function calculateBufferedDuration(
  baseDuration: number,
  multiplier: number
): number {
  return Math.ceil((baseDuration * multiplier) / 5) * 5;
}

// ---------------------------------------------------------------------------
// dropCardsToFitWindow
// ---------------------------------------------------------------------------

/**
 * Priority order used when deciding which cards to drop first.
 * Lower index = dropped sooner.
 */
const PRIORITY_DROP_ORDER: ActivityCard['priority'][] = ['Low', 'Medium', 'High'];

/**
 * Drops Activity Cards from the given list until the total bufferedDuration
 * fits within `availableMinutes`, following the priority-based dropping rules:
 *
 * 1. Drop Low-priority cards first, then Medium-priority cards.
 * 2. High-priority cards are NEVER dropped.
 * 3. Within the same priority tier, the card with the longest bufferedDuration
 *    is dropped first.
 * 4. If High-priority cards alone still exceed the window, a partial itinerary
 *    is returned with a warning message (Malaysian-English tone).
 *
 * The caller must pre-compute `bufferedDuration` on each card before calling
 * this function (use `calculateBufferedDuration`).
 *
 * @param cards            - Activity cards with pre-computed bufferedDuration
 * @param availableMinutes - Total available time window in minutes
 * @returns DropResult containing keptCards, droppedCards, and an optional warning
 *
 * @example
 * const cards = acceptedCards.map(c => ({
 *   ...c,
 *   bufferedDuration: calculateBufferedDuration(c.baseDuration, 1.25),
 * }));
 * const { keptCards, droppedCards, warning } = dropCardsToFitWindow(cards, 480);
 *
 * Validates: Requirements 4.4, 4.5, 4.8, 4.9, 5.5
 */
export function dropCardsToFitWindow(
  cards: ActivityCardWithBuffer[],
  availableMinutes: number
): DropResult {
  const totalRequired = (subset: ActivityCardWithBuffer[]) =>
    subset.reduce((sum, c) => sum + c.bufferedDuration, 0);

  // Fast path — everything already fits
  if (totalRequired(cards) <= availableMinutes) {
    return { keptCards: [...cards], droppedCards: [] };
  }

  // Work on a mutable copy; track dropped cards separately
  let remaining = [...cards];
  const dropped: ActivityCardWithBuffer[] = [];

  // Iterate through droppable tiers: Low first, then Medium (never High)
  for (const tier of PRIORITY_DROP_ORDER.slice(0, 2) as ('Low' | 'Medium')[]) {
    // While there are still cards in this tier and we're over budget, drop them
    while (totalRequired(remaining) > availableMinutes) {
      // Find the longest-bufferedDuration card in the current tier
      const tierCards = remaining
        .filter((c) => c.priority === tier)
        .sort((a, b) => b.bufferedDuration - a.bufferedDuration);

      if (tierCards.length === 0) {
        // No more cards in this tier — move to the next tier
        break;
      }

      const victim = tierCards[0];
      remaining = remaining.filter((c) => c.id !== victim.id);
      dropped.push(victim);
    }

    // Check if we've already fit within the window
    if (totalRequired(remaining) <= availableMinutes) {
      break;
    }
  }

  // After exhausting Low + Medium, check if High-only set still exceeds window
  if (totalRequired(remaining) > availableMinutes) {
    return {
      keptCards: remaining,
      droppedCards: dropped,
      warning:
        'Alamak, even your High-priority activities alone exceed the time window lah! ' +
        'You may want to extend your departure time or reduce the number of High-priority cards, boleh?',
    };
  }

  return { keptCards: remaining, droppedCards: dropped };
}

// ---------------------------------------------------------------------------
// assignStartEndTimes
// ---------------------------------------------------------------------------

/**
 * Walks an ordered list of activity cards and assigns `startTime` and
 * `endTime` to each, producing an array of `ScheduledActivity` objects.
 *
 * Algorithm (Design Step 5):
 * ```
 * activity[0].startTime = arrivalTime
 * activity[0].endTime   = arrivalTime + bufferedDuration[0]
 * activity[n].startTime = activity[n-1].endTime + restIntervalMinutes
 * activity[n].endTime   = activity[n].startTime + bufferedDuration[n]
 * ```
 *
 * @param cards                - Ordered activity cards with pre-computed bufferedDuration
 * @param arrivalTime          - HH:MM string representing the start of the itinerary
 * @param restIntervalMinutes  - Minutes to insert between consecutive activities.
 *                               Use 0 for Optimized / Makan-Focused routes,
 *                               15 for the Santai route. Defaults to 0.
 * @returns Array of ScheduledActivity objects with startTime and endTime set
 *
 * Validates: Requirements 4.2, 5.4, 6.5
 */
export function assignStartEndTimes(
  cards: ActivityCardWithBuffer[],
  arrivalTime: string,
  restIntervalMinutes: number = 0
): ScheduledActivity[] {
  const scheduled: ScheduledActivity[] = [];

  let currentTime = arrivalTime;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    // First activity starts at arrivalTime; subsequent ones start after the
    // previous activity's endTime plus the rest interval.
    const startTime =
      i === 0 ? currentTime : addMinutes(currentTime, restIntervalMinutes);

    const endTime = addMinutes(startTime, card.bufferedDuration);

    scheduled.push({
      cardTitle: card.title,
      location: card.location,
      price: card.price,
      priority: card.priority,
      startTime,
      endTime,
      bufferedDuration: card.bufferedDuration,
      isRestInterval: false,
    });

    // Advance the cursor to this activity's endTime for the next iteration
    currentTime = endTime;
  }

  return scheduled;
}

// ---------------------------------------------------------------------------
// Priority helpers
// ---------------------------------------------------------------------------

/** Numeric weight for priority — higher = more important. */
const PRIORITY_WEIGHT: Record<ActivityCard['priority'], number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

// ---------------------------------------------------------------------------
// orderOptimized
// ---------------------------------------------------------------------------

/**
 * Orders activity cards to minimise total road travel distance using a
 * nearest-neighbour heuristic on geographic zones within the destination city.
 *
 * MVP implementation: for MVP we don't have real geo-coordinates, so we sort
 * by priority (High first) as a proxy for "most important first" ordering.
 * Tie-break: higher-priority card goes earlier; equal-priority cards retain
 * their original relative order (stable sort).
 *
 * @param cards       - Activity cards with pre-computed bufferedDuration
 * @param destination - Destination city/state string (used for future geo lookup)
 * @returns New array of cards ordered for the Optimized route
 *
 * Validates: Requirements 5.2
 */
export function orderOptimized(
  cards: ActivityCardWithBuffer[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  destination: string
): ActivityCardWithBuffer[] {
  // Stable sort: higher priority weight → earlier in the list.
  // Array.prototype.sort is stable in V8 (Node 11+) and all modern browsers.
  return [...cards].sort(
    (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
  );
}

// ---------------------------------------------------------------------------
// orderMakanFocused
// ---------------------------------------------------------------------------

/** Meal window definitions (inclusive start, exclusive end in minutes). */
const MEAL_WINDOWS = [
  { name: 'breakfast', start: parseHHMM('07:00'), end: parseHHMM('09:00') },
  { name: 'lunch',     start: parseHHMM('12:00'), end: parseHHMM('14:00') },
  { name: 'dinner',    start: parseHHMM('18:00'), end: parseHHMM('21:00') },
] as const;

/**
 * Orders activity cards for the Makan-Focused route by slotting Food-category
 * cards into designated meal windows and filling remaining slots with
 * non-food cards ordered by priority.
 *
 * Algorithm:
 * 1. Walk through meal windows that overlap with the user's time window.
 * 2. For each window, try to assign the best available Food card first;
 *    if none is available, fall back to the highest-priority non-food card.
 * 3. Remaining unassigned cards are appended in priority order.
 *
 * @param cards         - Activity cards with pre-computed bufferedDuration
 * @param arrivalTime   - HH:MM string — start of the user's time window
 * @param departureTime - HH:MM string — end of the user's time window
 * @returns New array of cards ordered for the Makan-Focused route
 *
 * Validates: Requirements 5.3
 */
export function orderMakanFocused(
  cards: ActivityCardWithBuffer[],
  arrivalTime: string,
  departureTime: string
): ActivityCardWithBuffer[] {
  const arrivalMinutes   = parseHHMM(arrivalTime);
  const departureMinutes = parseHHMM(departureTime);

  // Track which cards have been assigned to a slot
  const assigned = new Set<string>(); // card ids
  const ordered: ActivityCardWithBuffer[] = [];

  // Helper: pick the best card from a candidate list (not yet assigned)
  const pickBest = (candidates: ActivityCardWithBuffer[]): ActivityCardWithBuffer | undefined =>
    candidates
      .filter((c) => !assigned.has(c.id))
      .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])[0];

  // Walk through meal windows that fall within the user's time window
  for (const window of MEAL_WINDOWS) {
    // Skip windows that don't overlap with the user's available time
    if (window.end <= arrivalMinutes || window.start >= departureMinutes) {
      continue;
    }

    // Try Food cards first
    const foodCandidates = cards.filter((c) => c.category === 'Food');
    const foodPick = pickBest(foodCandidates);

    if (foodPick) {
      ordered.push(foodPick);
      assigned.add(foodPick.id);
    } else {
      // Fall back to highest-priority non-food card
      const nonFoodCandidates = cards.filter((c) => c.category !== 'Food');
      const fallbackPick = pickBest(nonFoodCandidates);
      if (fallbackPick) {
        ordered.push(fallbackPick);
        assigned.add(fallbackPick.id);
      }
    }
  }

  // Append remaining unassigned cards in priority order
  const remaining = cards
    .filter((c) => !assigned.has(c.id))
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);

  return [...ordered, ...remaining];
}

// ---------------------------------------------------------------------------
// orderSantai
// ---------------------------------------------------------------------------

/**
 * Return value of orderSantai.
 */
export interface SantaiResult {
  orderedCards: ActivityCardWithBuffer[];
  droppedCards: ActivityCardWithBuffer[];
  warning?: string;
}

/**
 * Orders activity cards for the Santai (relaxed) route:
 *
 * 1. Applies a 1.30× Human Error Buffer to every card's baseDuration.
 * 2. Drops lowest-priority cards (longest first within tier) until the total
 *    duration — including 15-minute rest intervals between every consecutive
 *    pair of activities — fits within `availableMinutes`.
 * 3. Returns the ordered card list, dropped cards, and an optional warning.
 *
 * The returned `orderedCards` have their `bufferedDuration` set to the
 * 1.30× buffered value (rounded up to nearest 5 minutes).
 *
 * @param cards            - Raw ActivityCards (bufferedDuration will be recomputed at 1.30×)
 * @param availableMinutes - Total available time window in minutes
 * @returns SantaiResult with orderedCards, droppedCards, and optional warning
 *
 * Validates: Requirements 5.4, 5.5
 */
export function orderSantai(
  cards: ActivityCard[],
  availableMinutes: number
): SantaiResult {
  const SANTAI_MULTIPLIER = 1.30;
  const REST_INTERVAL     = 15; // minutes between consecutive activities

  // Recompute bufferedDuration at 1.30× for every card
  const buffered: ActivityCardWithBuffer[] = cards.map((c) => ({
    ...c,
    bufferedDuration: calculateBufferedDuration(c.baseDuration, SANTAI_MULTIPLIER),
  }));

  /**
   * Total time required for a given subset:
   *   sum(bufferedDurations) + (n - 1) × 15 min rest intervals
   */
  const totalRequired = (subset: ActivityCardWithBuffer[]): number => {
    if (subset.length === 0) return 0;
    const activityTime = subset.reduce((sum, c) => sum + c.bufferedDuration, 0);
    const restTime     = (subset.length - 1) * REST_INTERVAL;
    return activityTime + restTime;
  };

  // Fast path — everything already fits
  if (totalRequired(buffered) <= availableMinutes) {
    return { orderedCards: buffered, droppedCards: [] };
  }

  // Drop lowest-priority cards (longest bufferedDuration first within tier)
  let remaining = [...buffered];
  const dropped: ActivityCardWithBuffer[] = [];

  for (const tier of PRIORITY_DROP_ORDER.slice(0, 2) as ('Low' | 'Medium')[]) {
    while (totalRequired(remaining) > availableMinutes) {
      const tierCards = remaining
        .filter((c) => c.priority === tier)
        .sort((a, b) => b.bufferedDuration - a.bufferedDuration);

      if (tierCards.length === 0) break;

      const victim = tierCards[0];
      remaining = remaining.filter((c) => c.id !== victim.id);
      dropped.push(victim);
    }

    if (totalRequired(remaining) <= availableMinutes) break;
  }

  // Check if High-priority cards alone still exceed the window
  if (totalRequired(remaining) > availableMinutes) {
    return {
      orderedCards: remaining,
      droppedCards: dropped,
      warning:
        'Alamak, even your High-priority activities with Santai buffers exceed the time window lah! ' +
        'You may want to extend your departure time or reduce the number of High-priority cards, boleh?',
    };
  }

  return { orderedCards: remaining, droppedCards: dropped };
}
