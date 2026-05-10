// Feature: my-buddy-itinerary-planner, Property 7: human error buffer calculation
// Feature: my-buddy-itinerary-planner, Property 8: priority-based card dropping invariant
// Feature: my-buddy-itinerary-planner, Property 12: santai rest interval invariant
// Feature: my-buddy-itinerary-planner, Property 14: time window boundary preservation

import * as fc from 'fast-check';
import {
  calculateBufferedDuration,
  dropCardsToFitWindow,
  assignStartEndTimes,
  orderSantai,
  orderMakanFocused,
  type ActivityCardWithBuffer,
} from '../itinerary-engine';
import { formatHHMM, parseHHMM } from '../time-utils';

// ---------------------------------------------------------------------------
// Shared arbitraries
// ---------------------------------------------------------------------------

/** Generates a valid HH:MM arrival time string. */
const validArrivalTimeArb = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => formatHHMM(h * 60 + m));

/** Generates a valid price string matching the schema regex. */
const priceArb = fc.oneof(
  fc.constant('Free'),
  fc.integer({ min: 1, max: 200 }).map((n) => `RM${n}`),
  fc
    .tuple(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 101, max: 200 }))
    .map(([lo, hi]) => `RM${lo}–RM${hi}`)
);

/** Generates a valid category value. */
const categoryArb = fc.constantFrom(
  'Food',
  'Culture',
  'Nature',
  'Shopping',
  'Entertainment',
  'Other'
) as fc.Arbitrary<'Food' | 'Culture' | 'Nature' | 'Shopping' | 'Entertainment' | 'Other'>;

/** Generates a priority value. */
const priorityArb = fc.constantFrom(
  'High',
  'Medium',
  'Low'
) as fc.Arbitrary<'High' | 'Medium' | 'Low'>;

/**
 * Generates an ActivityCardWithBuffer with a pre-computed bufferedDuration.
 * baseDuration is in [1, 240] to keep total durations tractable.
 */
const activityCardWithBufferArb: fc.Arbitrary<ActivityCardWithBuffer> = fc
  .record({
    id: fc.uuid(),
    type: fc.constant('activity' as const),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ minLength: 1, maxLength: 100 }),
    location: fc.string({ minLength: 1, maxLength: 50 }),
    baseDuration: fc.integer({ min: 1, max: 240 }),
    price: priceArb,
    priority: priorityArb,
    category: categoryArb,
  })
  .map((card) => ({
    ...card,
    bufferedDuration: calculateBufferedDuration(card.baseDuration, 1.25),
  }));

/** Generates a non-empty array of ActivityCardWithBuffer (1–10 cards). */
const nonEmptyCardsArb = fc.array(activityCardWithBufferArb, { minLength: 1, maxLength: 10 });

// ---------------------------------------------------------------------------
// Property 7: Human Error Buffer Calculation
// Validates: Requirements 4.2, 5.4
// ---------------------------------------------------------------------------

describe('Property 7: Human Error Buffer Calculation', () => {
  it('equals Math.ceil((baseDuration * multiplier) / 5) * 5 for all valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 720 }),
        fc.constantFrom(1.25, 1.30),
        (baseDuration, multiplier) => {
          const expected = Math.ceil((baseDuration * multiplier) / 5) * 5;
          const result = calculateBufferedDuration(baseDuration, multiplier);
          return result === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('is always a multiple of 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 720 }),
        fc.constantFrom(1.25, 1.30),
        (baseDuration, multiplier) => {
          const result = calculateBufferedDuration(baseDuration, multiplier);
          return result % 5 === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('is always >= baseDuration (buffer never reduces duration)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 720 }),
        fc.constantFrom(1.25, 1.30),
        (baseDuration, multiplier) => {
          const result = calculateBufferedDuration(baseDuration, multiplier);
          return result >= baseDuration;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 14: Time Window Boundary Preservation
// Validates: Requirements 6.5
// ---------------------------------------------------------------------------

describe('Property 14: Time Window Boundary Preservation', () => {
  it('first scheduled activity startTime equals arrivalTime exactly (no rounding or shift)', () => {
    fc.assert(
      fc.property(
        validArrivalTimeArb,
        nonEmptyCardsArb,
        (arrivalTime, cards) => {
          const result = assignStartEndTimes(cards, arrivalTime);
          return result[0].startTime === arrivalTime;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('first activity startTime equals arrivalTime exactly regardless of restIntervalMinutes', () => {
    fc.assert(
      fc.property(
        validArrivalTimeArb,
        nonEmptyCardsArb,
        fc.integer({ min: 0, max: 60 }),
        (arrivalTime, cards, restIntervalMinutes) => {
          const result = assignStartEndTimes(cards, arrivalTime, restIntervalMinutes);
          return result[0].startTime === arrivalTime;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('produces exactly one ScheduledActivity per input card', () => {
    fc.assert(
      fc.property(
        validArrivalTimeArb,
        nonEmptyCardsArb,
        (arrivalTime, cards) => {
          const result = assignStartEndTimes(cards, arrivalTime);
          return result.length === cards.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------

/**
 * Property 8: Priority-Based Card Dropping Invariant
 * Validates: Requirements 4.4, 4.5, 5.5
 *
 * For any set of ActivityCard objects and any available time window (in
 * minutes), when the total bufferedDuration exceeds the window, the
 * card-dropping algorithm SHALL:
 *   (a) never drop a High-priority card,
 *   (b) drop all Low-priority cards before dropping any Medium-priority card,
 *   (c) within the same priority tier, drop the card with the longest
 *       bufferedDuration first,
 *   (d) the resulting card set SHALL have a total bufferedDuration that fits
 *       within the available time window, or consist solely of High-priority
 *       cards if no fitting subset exists.
 */
describe('Property 8: Priority-Based Card Dropping Invariant', () => {
  /**
   * (a) No High-priority card is ever dropped.
   *
   * Strategy: generate a non-empty array of cards and a time window that is
   * smaller than the total bufferedDuration (forcing drops). Assert that every
   * card in droppedCards has priority !== 'High'.
   */
  it('(a) never drops a High-priority card', () => {
    fc.assert(
      fc.property(
        // At least 2 cards so there is something to drop
        fc.array(activityCardWithBufferArb, { minLength: 2, maxLength: 10 }),
        fc.integer({ min: 1, max: 60 }), // tight window to force drops
        (cards, availableMinutes) => {
          const { droppedCards } = dropCardsToFitWindow(cards, availableMinutes);
          return droppedCards.every((c) => c.priority !== 'High');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * (b) All Low-priority cards are dropped before any Medium-priority card.
   *
   * Strategy: generate cards that include at least one Low and one Medium card,
   * with a window tight enough to force dropping. Assert that if any Medium
   * card was dropped, then ALL Low cards were also dropped.
   */
  it('(b) drops all Low-priority cards before any Medium-priority card', () => {
    fc.assert(
      fc.property(
        fc.array(activityCardWithBufferArb, { minLength: 3, maxLength: 12 }),
        fc.integer({ min: 1, max: 80 }),
        (cards, availableMinutes) => {
          const { droppedCards } = dropCardsToFitWindow(cards, availableMinutes);

          const droppedMedium = droppedCards.filter(
            (c) => c.priority === 'Medium'
          );
          const droppedLow = droppedCards.filter((c) => c.priority === 'Low');
          const totalLow = cards.filter((c) => c.priority === 'Low').length;

          // If any Medium card was dropped, ALL Low cards must have been dropped first
          if (droppedMedium.length > 0) {
            return droppedLow.length === totalLow;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * (c) Within the same priority tier, the card with the longest
   *     bufferedDuration is dropped first.
   *
   * Strategy: generate cards and a tight window. For each priority tier
   * (Low, Medium), verify that among the dropped cards in that tier, no
   * kept card in the same tier has a strictly longer bufferedDuration than
   * the shortest dropped card in that tier.
   *
   * In other words: max(kept[tier].bufferedDuration) <=
   *                 min(dropped[tier].bufferedDuration)
   */
  it('(c) within the same tier, drops the longest-bufferedDuration card first', () => {
    fc.assert(
      fc.property(
        fc.array(activityCardWithBufferArb, { minLength: 2, maxLength: 12 }),
        fc.integer({ min: 1, max: 80 }),
        (cards, availableMinutes) => {
          const { keptCards, droppedCards } = dropCardsToFitWindow(
            cards,
            availableMinutes
          );

          for (const tier of ['Low', 'Medium'] as const) {
            const droppedInTier = droppedCards.filter(
              (c) => c.priority === tier
            );
            const keptInTier = keptCards.filter((c) => c.priority === tier);

            if (droppedInTier.length === 0 || keptInTier.length === 0) {
              // Nothing to compare for this tier
              continue;
            }

            const minDroppedDuration = Math.min(
              ...droppedInTier.map((c) => c.bufferedDuration)
            );
            const maxKeptDuration = Math.max(
              ...keptInTier.map((c) => c.bufferedDuration)
            );

            // Every kept card in this tier must have bufferedDuration <=
            // the smallest dropped card in the same tier
            if (maxKeptDuration > minDroppedDuration) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * (d) The resulting card set fits within the window, OR consists solely of
   *     High-priority cards (when even High-only exceeds the window).
   *
   * Strategy: generate cards and a time window. Assert that after dropping,
   * either:
   *   - total bufferedDuration of keptCards <= availableMinutes, OR
   *   - every keptCard has priority === 'High' (High-only partial itinerary).
   */
  it('(d) result fits the window or is High-priority-only', () => {
    fc.assert(
      fc.property(
        fc.array(activityCardWithBufferArb, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 120 }),
        (cards, availableMinutes) => {
          const { keptCards } = dropCardsToFitWindow(cards, availableMinutes);

          const totalKept = keptCards.reduce(
            (sum, c) => sum + c.bufferedDuration,
            0
          );
          const allHigh = keptCards.every((c) => c.priority === 'High');

          return totalKept <= availableMinutes || allHigh;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Composite: all four invariants hold simultaneously.
   *
   * This test exercises all four sub-properties in a single property run,
   * providing a combined correctness check across a wider input space.
   */
  it('all four invariants hold simultaneously for any input', () => {
    fc.assert(
      fc.property(
        fc.array(activityCardWithBufferArb, { minLength: 1, maxLength: 15 }),
        fc.integer({ min: 1, max: 300 }),
        (cards, availableMinutes) => {
          const { keptCards, droppedCards } = dropCardsToFitWindow(
            cards,
            availableMinutes
          );

          // (a) No High card dropped
          const noHighDropped = droppedCards.every(
            (c) => c.priority !== 'High'
          );

          // (b) All Low dropped before any Medium
          const droppedMedium = droppedCards.filter(
            (c) => c.priority === 'Medium'
          );
          const droppedLow = droppedCards.filter((c) => c.priority === 'Low');
          const totalLow = cards.filter((c) => c.priority === 'Low').length;
          const lowBeforeMedium =
            droppedMedium.length === 0 || droppedLow.length === totalLow;

          // (c) Longest-first within tier
          let longestFirstWithinTier = true;
          for (const tier of ['Low', 'Medium'] as const) {
            const droppedInTier = droppedCards.filter(
              (c) => c.priority === tier
            );
            const keptInTier = keptCards.filter((c) => c.priority === tier);
            if (droppedInTier.length > 0 && keptInTier.length > 0) {
              const minDropped = Math.min(
                ...droppedInTier.map((c) => c.bufferedDuration)
              );
              const maxKept = Math.max(
                ...keptInTier.map((c) => c.bufferedDuration)
              );
              if (maxKept > minDropped) {
                longestFirstWithinTier = false;
                break;
              }
            }
          }

          // (d) Fits window or High-only
          const totalKept = keptCards.reduce(
            (sum, c) => sum + c.bufferedDuration,
            0
          );
          const allHigh = keptCards.every((c) => c.priority === 'High');
          const fitsOrHighOnly = totalKept <= availableMinutes || allHigh;

          return (
            noHighDropped &&
            lowBeforeMedium &&
            longestFirstWithinTier &&
            fitsOrHighOnly
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Santai Route Rest Interval Invariant
// Validates: Requirements 5.4
// ---------------------------------------------------------------------------

/**
 * Generates a valid ActivityCard (without bufferedDuration) for use with
 * orderSantai, which accepts raw ActivityCard[] and recomputes bufferedDuration
 * internally at 1.30×.
 */
const rawActivityCardArb = fc
  .record({
    id: fc.uuid(),
    type: fc.constant('activity' as const),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ minLength: 1, maxLength: 100 }),
    location: fc.string({ minLength: 1, maxLength: 50 }),
    baseDuration: fc.integer({ min: 1, max: 120 }),
    price: priceArb,
    priority: priorityArb,
    category: categoryArb,
  });

describe('Property 12: Santai Route Rest Interval Invariant', () => {
  /**
   * (1) Each activity's bufferedDuration equals Math.ceil((baseDuration * 1.30) / 5) * 5.
   *
   * Strategy: generate ≥ 2 raw ActivityCards with a large enough availableMinutes
   * window so no cards are dropped. Assert every orderedCard's bufferedDuration
   * matches the 1.30× formula.
   */
  it('(1) each bufferedDuration equals Math.ceil((baseDuration * 1.30) / 5) * 5', () => {
    fc.assert(
      fc.property(
        // At least 2 cards
        fc.array(rawActivityCardArb, { minLength: 2, maxLength: 8 }),
        (cards) => {
          // Use a very large window so nothing gets dropped
          const availableMinutes = 9999;
          const { orderedCards } = orderSantai(cards, availableMinutes);

          return orderedCards.every((card) => {
            const expected = Math.ceil((card.baseDuration * 1.30) / 5) * 5;
            return card.bufferedDuration === expected;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * (2) Gap between consecutive endTime / startTime is exactly 15 minutes.
   *
   * Strategy: generate ≥ 2 raw ActivityCards with a large enough window,
   * call orderSantai then assignStartEndTimes with restIntervalMinutes=15.
   * Assert that for every consecutive pair (i, i+1):
   *   parseHHMM(activities[i+1].startTime) - parseHHMM(activities[i].endTime) === 15
   */
  it('(2) gap between consecutive endTime and startTime is exactly 15 minutes', () => {
    fc.assert(
      fc.property(
        fc.array(rawActivityCardArb, { minLength: 2, maxLength: 8 }),
        validArrivalTimeArb,
        (cards, arrivalTime) => {
          // Large window — no drops
          const availableMinutes = 9999;
          const { orderedCards } = orderSantai(cards, availableMinutes);

          // Need at least 2 ordered cards to check gaps
          if (orderedCards.length < 2) return true;

          const scheduled = assignStartEndTimes(orderedCards, arrivalTime, 15);

          for (let i = 0; i < scheduled.length - 1; i++) {
            const endMinutes   = parseHHMM(scheduled[i].endTime);
            const startMinutes = parseHHMM(scheduled[i + 1].startTime);

            // Handle midnight crossing: if startMinutes < endMinutes, add 1440
            const gap =
              startMinutes >= endMinutes
                ? startMinutes - endMinutes
                : startMinutes + 1440 - endMinutes;

            if (gap !== 15) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Composite: both invariants hold simultaneously for any Santai output
   * with ≥ 2 activities.
   */
  it('both invariants hold simultaneously for any Santai route with ≥ 2 activities', () => {
    fc.assert(
      fc.property(
        fc.array(rawActivityCardArb, { minLength: 2, maxLength: 8 }),
        validArrivalTimeArb,
        (cards, arrivalTime) => {
          const availableMinutes = 9999;
          const { orderedCards } = orderSantai(cards, availableMinutes);

          if (orderedCards.length < 2) return true;

          // (1) bufferedDuration formula
          const correctBuffers = orderedCards.every((card) => {
            const expected = Math.ceil((card.baseDuration * 1.30) / 5) * 5;
            return card.bufferedDuration === expected;
          });

          if (!correctBuffers) return false;

          // (2) 15-minute rest gaps
          const scheduled = assignStartEndTimes(orderedCards, arrivalTime, 15);

          for (let i = 0; i < scheduled.length - 1; i++) {
            const endMinutes   = parseHHMM(scheduled[i].endTime);
            const startMinutes = parseHHMM(scheduled[i + 1].startTime);

            const gap =
              startMinutes >= endMinutes
                ? startMinutes - endMinutes
                : startMinutes + 1440 - endMinutes;

            if (gap !== 15) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Makan-Focused Food Scheduling
// Feature: my-buddy-itinerary-planner, Property 11: makan-focused food scheduling
// Validates: Requirements 5.3
// ---------------------------------------------------------------------------

// orderMakanFocused and parseHHMM are already imported at the top of this file

/**
 * Meal window definitions (minutes since midnight), matching the engine's
 * internal MEAL_WINDOWS constant.
 */
const MEAL_WINDOWS_MINUTES = [
  { name: 'breakfast', start: parseHHMM('07:00'), end: parseHHMM('09:00') },
  { name: 'lunch',     start: parseHHMM('12:00'), end: parseHHMM('14:00') },
  { name: 'dinner',    start: parseHHMM('18:00'), end: parseHHMM('21:00') },
] as const;

/** Returns true if a HH:MM startTime falls within any designated meal window. */
function isInMealWindow(startTime: string): boolean {
  const minutes = parseHHMM(startTime);
  return MEAL_WINDOWS_MINUTES.some(
    (w) => minutes >= w.start && minutes < w.end
  );
}

/**
 * Generates an ActivityCardWithBuffer whose category is always 'Food'.
 * baseDuration is kept small (1–60 min) so the card fits comfortably inside
 * a meal window.
 */
const foodCardArb: fc.Arbitrary<ActivityCardWithBuffer> = fc
  .record({
    id: fc.uuid(),
    type: fc.constant('activity' as const),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ minLength: 1, maxLength: 100 }),
    location: fc.string({ minLength: 1, maxLength: 50 }),
    baseDuration: fc.integer({ min: 1, max: 60 }),
    price: priceArb,
    priority: priorityArb,
    category: fc.constant('Food' as const),
  })
  .map((card) => ({
    ...card,
    bufferedDuration: calculateBufferedDuration(card.baseDuration, 1.25),
  }));

/**
 * Generates an ActivityCardWithBuffer whose category is never 'Food'.
 */
const nonFoodCardArb: fc.Arbitrary<ActivityCardWithBuffer> = fc
  .record({
    id: fc.uuid(),
    type: fc.constant('activity' as const),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ minLength: 1, maxLength: 100 }),
    location: fc.string({ minLength: 1, maxLength: 50 }),
    baseDuration: fc.integer({ min: 1, max: 60 }),
    price: priceArb,
    priority: priorityArb,
    category: fc.constantFrom(
      'Culture',
      'Nature',
      'Shopping',
      'Entertainment',
      'Other'
    ) as fc.Arbitrary<'Culture' | 'Nature' | 'Shopping' | 'Entertainment' | 'Other'>,
  })
  .map((card) => ({
    ...card,
    bufferedDuration: calculateBufferedDuration(card.baseDuration, 1.25),
  }));

/**
 * Generates a (arrivalTime, departureTime) pair that is guaranteed to overlap
 * with at least one meal window.
 *
 * Strategy: pick an arrivalTime strictly inside one of the three meal windows
 * (so the window.start < arrivalTime < window.end condition is satisfied),
 * then pick a departureTime at least 30 minutes later.
 *
 * Meal window interiors (exclusive of the boundary minute):
 *   breakfast: 07:00–08:59  → [420, 539]
 *   lunch:     12:00–13:59  → [720, 839]
 *   dinner:    18:00–20:59  → [1080, 1259]
 *
 * Using the start of each window (inclusive) ensures the engine sees the
 * window as overlapping (engine check: window.end > arrivalMinutes AND
 * window.start < departureMinutes).
 */
const mealWindowTimeArb: fc.Arbitrary<{ arrivalTime: string; departureTime: string }> = fc
  .constantFrom(
    // Arrival at the start of each meal window
    parseHHMM('07:00'), // breakfast start
    parseHHMM('12:00'), // lunch start
    parseHHMM('18:00'), // dinner start
  )
  .chain((arrivalMinutes) =>
    fc
      .integer({ min: arrivalMinutes + 30, max: Math.min(arrivalMinutes + 480, parseHHMM('23:59')) })
      .map((departureMinutes) => ({
        arrivalTime: formatHHMM(arrivalMinutes),
        departureTime: formatHHMM(departureMinutes),
      }))
  );

describe('Property 11: Makan-Focused Food Scheduling', () => {
  /**
   * Core property: at least one Food card is scheduled within a meal window.
   *
   * The engine slots Food cards into meal windows greedily (one per overlapping
   * window). When the time window overlaps exactly one meal window, the first
   * Food card is placed there; additional Food cards are appended after all
   * meal-window slots are filled. The property asserts that the engine always
   * places at least one Food card inside a meal window when the time window
   * overlaps one.
   *
   * **Validates: Requirements 5.3**
   *
   * Strategy:
   * 1. Generate exactly one Food card and zero or more non-food cards.
   * 2. Generate a time window whose arrivalTime is at the start of a meal window
   *    (07:00, 12:00, or 18:00), guaranteeing overlap.
   * 3. Call orderMakanFocused → assignStartEndTimes.
   * 4. Assert the Food card's startTime falls within a meal window.
   */
  it('schedules at least one Food card within a designated meal window', () => {
    fc.assert(
      fc.property(
        // Exactly one Food card to keep the assertion unambiguous
        foodCardArb,
        // Zero or more non-food cards
        fc.array(nonFoodCardArb, { minLength: 0, maxLength: 5 }),
        mealWindowTimeArb,
        (foodCard, nonFoodCards, { arrivalTime, departureTime }) => {
          const allCards = [foodCard, ...nonFoodCards];

          // Build the Makan-Focused ordering
          const ordered = orderMakanFocused(allCards, arrivalTime, departureTime);

          // Assign start/end times (no rest interval for Makan-Focused)
          const scheduled = assignStartEndTimes(ordered, arrivalTime, 0);

          // Find the scheduled entry for the Food card
          const foodScheduled = scheduled.find((s) => s.cardTitle === foodCard.title);
          if (!foodScheduled) return false;

          // The Food card's startTime must fall within a meal window
          return isInMealWindow(foodScheduled.startTime);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Corollary: when there is exactly one Food card and the time window
   * covers exactly one meal window, that Food card is the first scheduled
   * activity (it gets slotted into the meal window immediately).
   *
   * **Validates: Requirements 5.3**
   */
  it('places the Food card first when the window starts at a meal window boundary', () => {
    fc.assert(
      fc.property(
        foodCardArb,
        fc.array(nonFoodCardArb, { minLength: 0, maxLength: 4 }),
        // Arrival exactly at a meal window start: 07:00, 12:00, or 18:00
        fc.constantFrom('07:00', '12:00', '18:00'),
        (foodCard, nonFoodCards, arrivalTime) => {
          // Departure is 2 hours after arrival to cover the meal window
          const departureTime = formatHHMM(parseHHMM(arrivalTime) + 120);
          const allCards = [foodCard, ...nonFoodCards];

          const ordered = orderMakanFocused(allCards, arrivalTime, departureTime);
          const scheduled = assignStartEndTimes(ordered, arrivalTime, 0);

          // The first scheduled activity must be the Food card
          return scheduled[0].cardTitle === foodCard.title;
        }
      ),
      { numRuns: 100 }
    );
  });
});
