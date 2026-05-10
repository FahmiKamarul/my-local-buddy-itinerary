// Feature: my-buddy-itinerary-planner, Property 16: Zod schema round-trip
// Validates: Requirements 9.1, 9.2

import * as fc from 'fast-check';
import { ZodError } from 'zod';
import {
  CardSchema,
  ItineraryResultSchema,
  ScheduledActivitySchema,
  RouteItinerarySchema,
} from '../schemas';

// ---------------------------------------------------------------------------
// Arbitraries — valid shapes
// ---------------------------------------------------------------------------

/** Generates a valid UUID v4 string */
const arbUuid = fc.uuid();

/** Generates a valid price string matching /^(Free|RM\s?\d+(\s?[–-]\s?RM?\s?\d+)?)$/ */
const arbPrice = fc.oneof(
  fc.constant('Free'),
  fc.integer({ min: 1, max: 999 }).map((n) => `RM${n}`),
  fc.integer({ min: 1, max: 999 }).map((n) => `RM ${n}`),
  fc
    .tuple(
      fc.integer({ min: 1, max: 500 }),
      fc.integer({ min: 501, max: 999 })
    )
    .map(([lo, hi]) => `RM${lo}-RM${hi}`),
  fc
    .tuple(
      fc.integer({ min: 1, max: 500 }),
      fc.integer({ min: 501, max: 999 })
    )
    .map(([lo, hi]) => `RM${lo} - RM${hi}`)
);

const arbPriority = fc.constantFrom('High', 'Medium', 'Low') as fc.Arbitrary<
  'High' | 'Medium' | 'Low'
>;

const arbCategory = fc.constantFrom(
  'Food',
  'Culture',
  'Nature',
  'Shopping',
  'Entertainment',
  'Other'
) as fc.Arbitrary<
  'Food' | 'Culture' | 'Nature' | 'Shopping' | 'Entertainment' | 'Other'
>;

/** Generates a non-empty string up to maxLen characters */
const arbNonEmptyString = (maxLen: number) =>
  fc.string({ minLength: 1, maxLength: maxLen });

/** Generates a valid activity Card object */
const arbValidActivityCard = fc.record({
  id: arbUuid,
  type: fc.constant('activity' as const),
  title: arbNonEmptyString(100),
  description: arbNonEmptyString(300),
  location: arbNonEmptyString(100),
  baseDuration: fc.integer({ min: 1, max: 720 }),
  price: arbPrice,
  priority: arbPriority,
  category: arbCategory,
});

/** Generates a valid question Card object */
const arbValidQuestionCard = fc.record({
  id: arbUuid,
  type: fc.constant('question' as const),
  title: arbNonEmptyString(100),
  description: arbNonEmptyString(300),
});

/** Generates either a valid activity or question card */
const arbValidCard = fc.oneof(arbValidActivityCard, arbValidQuestionCard);

/** Generates a valid HH:MM time string */
const arbHHMM = fc
  .tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  )
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

/** Generates a valid ScheduledActivity object */
const arbScheduledActivity = fc.record({
  cardTitle: arbNonEmptyString(100),
  location: arbNonEmptyString(100),
  price: arbPrice,
  priority: arbPriority,
  startTime: arbHHMM,
  endTime: arbHHMM,
  bufferedDuration: fc.integer({ min: 1, max: 1440 }),
  isRestInterval: fc.boolean(),
});

/** Generates a valid RouteItinerary object */
const arbRouteItinerary = (
  route: 'optimized' | 'makan-focused' | 'santai'
) =>
  fc.record({
    route: fc.constant(route),
    activities: fc.array(arbScheduledActivity, { minLength: 1, maxLength: 20 }),
    totalDuration: fc.integer({ min: 1, max: 1440 }),
    droppedCards: fc.array(arbNonEmptyString(100), { maxLength: 10 }),
    warningMessage: fc.option(arbNonEmptyString(200), { nil: undefined }),
  });

/** Generates a valid ItineraryResult object */
const arbValidItineraryResult = fc.record({
  destination: arbNonEmptyString(100),
  arrivalTime: arbHHMM,
  departureTime: arbHHMM,
  routes: fc
    .tuple(
      arbRouteItinerary('optimized'),
      arbRouteItinerary('makan-focused'),
      arbRouteItinerary('santai')
    )
    .map(([a, b, c]) => [a, b, c] as [typeof a, typeof b, typeof c]),
});

// ---------------------------------------------------------------------------
// Property 16a — CardSchema: valid objects parse successfully and round-trip
// ---------------------------------------------------------------------------

describe('Property 16: Zod Schema Round-Trip', () => {
  test('CardSchema: valid card objects parse successfully and are deeply equal to input', () => {
    fc.assert(
      fc.property(arbValidCard, (card) => {
        const result = CardSchema.safeParse(card);
        expect(result.success).toBe(true);
        if (result.success) {
          // Deep equality: parsed output matches input for all present fields
          expect(result.data.id).toBe(card.id);
          expect(result.data.type).toBe(card.type);
          expect(result.data.title).toBe(card.title);
          expect(result.data.description).toBe(card.description);
          if ('location' in card) expect(result.data.location).toBe(card.location);
          if ('baseDuration' in card) expect(result.data.baseDuration).toBe(card.baseDuration);
          if ('price' in card) expect(result.data.price).toBe(card.price);
          if ('priority' in card) expect(result.data.priority).toBe(card.priority);
          if ('category' in card) expect(result.data.category).toBe(card.category);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ---------------------------------------------------------------------------
  // Property 16b — ItineraryResultSchema: valid objects parse successfully
  // ---------------------------------------------------------------------------

  test('ItineraryResultSchema: valid itinerary result objects parse successfully and are deeply equal to input', () => {
    fc.assert(
      fc.property(arbValidItineraryResult, (itinerary) => {
        const result = ItineraryResultSchema.safeParse(itinerary);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.destination).toBe(itinerary.destination);
          expect(result.data.arrivalTime).toBe(itinerary.arrivalTime);
          expect(result.data.departureTime).toBe(itinerary.departureTime);
          expect(result.data.routes).toHaveLength(3);
          expect(result.data.routes[0].route).toBe('optimized');
          expect(result.data.routes[1].route).toBe('makan-focused');
          expect(result.data.routes[2].route).toBe('santai');
        }
      }),
      { numRuns: 100 }
    );
  });

  // ---------------------------------------------------------------------------
  // Property 16c — CardSchema: invalid objects throw ZodError
  // ---------------------------------------------------------------------------

  test('CardSchema: objects with wrong type for required fields fail to parse', () => {
    // id is not a UUID
    const invalidId = { id: 'not-a-uuid', type: 'activity', title: 'Test', description: 'Desc' };
    const r1 = CardSchema.safeParse(invalidId);
    expect(r1.success).toBe(false);
    if (!r1.success) expect(r1.error).toBeInstanceOf(ZodError);

    // type is not a valid enum value
    const invalidType = { id: '550e8400-e29b-41d4-a716-446655440000', type: 'unknown', title: 'Test', description: 'Desc' };
    const r2 = CardSchema.safeParse(invalidType);
    expect(r2.success).toBe(false);
    if (!r2.success) expect(r2.error).toBeInstanceOf(ZodError);

    // title is empty string (min 1)
    const emptyTitle = { id: '550e8400-e29b-41d4-a716-446655440000', type: 'activity', title: '', description: 'Desc' };
    const r3 = CardSchema.safeParse(emptyTitle);
    expect(r3.success).toBe(false);
    if (!r3.success) expect(r3.error).toBeInstanceOf(ZodError);

    // title exceeds max 100 chars
    const longTitle = { id: '550e8400-e29b-41d4-a716-446655440000', type: 'activity', title: 'a'.repeat(101), description: 'Desc' };
    const r4 = CardSchema.safeParse(longTitle);
    expect(r4.success).toBe(false);
    if (!r4.success) expect(r4.error).toBeInstanceOf(ZodError);

    // baseDuration out of range (> 720)
    const badDuration = { id: '550e8400-e29b-41d4-a716-446655440000', type: 'activity', title: 'Test', description: 'Desc', baseDuration: 721 };
    const r5 = CardSchema.safeParse(badDuration);
    expect(r5.success).toBe(false);
    if (!r5.success) expect(r5.error).toBeInstanceOf(ZodError);

    // baseDuration is 0 (must be positive)
    const zeroDuration = { id: '550e8400-e29b-41d4-a716-446655440000', type: 'activity', title: 'Test', description: 'Desc', baseDuration: 0 };
    const r6 = CardSchema.safeParse(zeroDuration);
    expect(r6.success).toBe(false);
    if (!r6.success) expect(r6.error).toBeInstanceOf(ZodError);

    // price does not match pattern
    const badPrice = { id: '550e8400-e29b-41d4-a716-446655440000', type: 'activity', title: 'Test', description: 'Desc', price: '$10' };
    const r7 = CardSchema.safeParse(badPrice);
    expect(r7.success).toBe(false);
    if (!r7.success) expect(r7.error).toBeInstanceOf(ZodError);

    // priority is not a valid enum value
    const badPriority = { id: '550e8400-e29b-41d4-a716-446655440000', type: 'activity', title: 'Test', description: 'Desc', priority: 'Critical' };
    const r8 = CardSchema.safeParse(badPriority);
    expect(r8.success).toBe(false);
    if (!r8.success) expect(r8.error).toBeInstanceOf(ZodError);
  });

  test('CardSchema: missing required fields fail to parse', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Omit one required field at a time via partial generation
          missingField: fc.constantFrom('id', 'type', 'title', 'description'),
        }),
        ({ missingField }) => {
          const base: Record<string, unknown> = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: 'activity',
            title: 'Test Title',
            description: 'Test description',
          };
          delete base[missingField];
          const result = CardSchema.safeParse(base);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBeInstanceOf(ZodError);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ---------------------------------------------------------------------------
  // Property 16d — ItineraryResultSchema: invalid objects throw ZodError
  // ---------------------------------------------------------------------------

  test('ItineraryResultSchema: objects with wrong types fail to parse', () => {
    // arrivalTime not matching HH:MM pattern
    const badArrival = {
      destination: 'Melaka',
      arrivalTime: '9:00',   // missing leading zero
      departureTime: '18:00',
      routes: [
        { route: 'optimized', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
        { route: 'makan-focused', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
        { route: 'santai', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
      ],
    };
    const r1 = ItineraryResultSchema.safeParse(badArrival);
    expect(r1.success).toBe(false);
    if (!r1.success) expect(r1.error).toBeInstanceOf(ZodError);

    // routes tuple has wrong length (only 2 instead of 3)
    const twoRoutes = {
      destination: 'Melaka',
      arrivalTime: '09:00',
      departureTime: '18:00',
      routes: [
        { route: 'optimized', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
        { route: 'makan-focused', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
      ],
    };
    const r2 = ItineraryResultSchema.safeParse(twoRoutes);
    expect(r2.success).toBe(false);
    if (!r2.success) expect(r2.error).toBeInstanceOf(ZodError);

    // totalDuration exceeds max 1440
    const badDuration = {
      destination: 'Melaka',
      arrivalTime: '09:00',
      departureTime: '18:00',
      routes: [
        { route: 'optimized', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 1441, droppedCards: [] },
        { route: 'makan-focused', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
        { route: 'santai', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
      ],
    };
    const r3 = ItineraryResultSchema.safeParse(badDuration);
    expect(r3.success).toBe(false);
    if (!r3.success) expect(r3.error).toBeInstanceOf(ZodError);

    // activities array is empty (min 1)
    const emptyActivities = {
      destination: 'Melaka',
      arrivalTime: '09:00',
      departureTime: '18:00',
      routes: [
        { route: 'optimized', activities: [], totalDuration: 60, droppedCards: [] },
        { route: 'makan-focused', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
        { route: 'santai', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
      ],
    };
    const r4 = ItineraryResultSchema.safeParse(emptyActivities);
    expect(r4.success).toBe(false);
    if (!r4.success) expect(r4.error).toBeInstanceOf(ZodError);
  });

  test('ItineraryResultSchema: missing required fields fail to parse', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('destination', 'arrivalTime', 'departureTime', 'routes'),
        (missingField) => {
          const base: Record<string, unknown> = {
            destination: 'Melaka',
            arrivalTime: '09:00',
            departureTime: '18:00',
            routes: [
              { route: 'optimized', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
              { route: 'makan-focused', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
              { route: 'santai', activities: [{ cardTitle: 'A', location: 'L', price: 'Free', priority: 'High', startTime: '09:00', endTime: '10:00', bufferedDuration: 60, isRestInterval: false }], totalDuration: 60, droppedCards: [] },
            ],
          };
          delete base[missingField];
          const result = ItineraryResultSchema.safeParse(base);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBeInstanceOf(ZodError);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
