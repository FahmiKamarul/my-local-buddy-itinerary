// Feature: my-buddy-itinerary-planner, Property 15: card data round-trip integrity
// Validates: Requirements 10.1, 10.2, 10.3

import * as fc from 'fast-check';
import { validateCardRoundTrip } from '../card-utils';
import { Card } from '../schemas';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a valid price string matching /^(Free|RM\s?\d+(\s?[–-]\s?RM?\s?\d+)?)$/ */
const arbPrice = fc.oneof(
  fc.constant('Free'),
  fc.integer({ min: 1, max: 999 }).map((n) => `RM${n}`),
  fc.integer({ min: 1, max: 999 }).map((n) => `RM ${n}`),
  fc
    .tuple(fc.integer({ min: 1, max: 500 }), fc.integer({ min: 501, max: 999 }))
    .map(([lo, hi]) => `RM${lo}-RM${hi}`),
  fc
    .tuple(fc.integer({ min: 1, max: 500 }), fc.integer({ min: 501, max: 999 }))
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

/** Generates a valid activity Card object (all five round-trip fields present) */
const arbActivityCard: fc.Arbitrary<Card> = fc.record({
  id: fc.uuid(),
  type: fc.constant('activity' as const),
  title: arbNonEmptyString(100),
  description: arbNonEmptyString(300),
  location: arbNonEmptyString(100),
  baseDuration: fc.integer({ min: 1, max: 720 }),
  price: arbPrice,
  priority: arbPriority,
  category: arbCategory,
});

/** Generates a valid question Card object (activity fields are absent/undefined) */
const arbQuestionCard: fc.Arbitrary<Card> = fc.record({
  id: fc.uuid(),
  type: fc.constant('question' as const),
  title: arbNonEmptyString(100),
  description: arbNonEmptyString(300),
});

/** Generates either a valid activity or question card */
const arbValidCard: fc.Arbitrary<Card> = fc.oneof(
  arbActivityCard,
  arbQuestionCard
);

// ---------------------------------------------------------------------------
// Property 15: Card Data Round-Trip Integrity
// ---------------------------------------------------------------------------

describe('Property 15: Card Data Round-Trip Integrity', () => {
  /**
   * For any valid Card object, validateCardRoundTrip must return true —
   * meaning JSON.stringify → JSON.parse preserves all five fields with
   * strict equality.
   */
  test('validateCardRoundTrip returns true for all valid activity cards', () => {
    fc.assert(
      fc.property(arbActivityCard, (card) => {
        expect(validateCardRoundTrip(card)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('validateCardRoundTrip returns true for all valid question cards', () => {
    fc.assert(
      fc.property(arbQuestionCard, (card) => {
        expect(validateCardRoundTrip(card)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('validateCardRoundTrip returns true for all valid cards (activity and question)', () => {
    fc.assert(
      fc.property(arbValidCard, (card) => {
        expect(validateCardRoundTrip(card)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Directly assert that JSON.parse(JSON.stringify(card)) produces strictly
   * equal values for all five fields — title, location, baseDuration, price,
   * and priority — for any valid activity card.
   */
  test('JSON round-trip preserves all five fields with strict equality for activity cards', () => {
    fc.assert(
      fc.property(arbActivityCard, (card) => {
        const roundTripped = JSON.parse(JSON.stringify(card)) as Card;

        expect(roundTripped.title).toBe(card.title);
        expect(roundTripped.location).toBe(card.location);
        expect(roundTripped.baseDuration).toBe(card.baseDuration);
        expect(roundTripped.price).toBe(card.price);
        expect(roundTripped.priority).toBe(card.priority);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * For question cards, the optional fields (location, baseDuration, price,
   * priority) are undefined both before and after the round-trip.
   * undefined fields are stripped by JSON.stringify, so JSON.parse returns
   * an object without those keys — accessing them yields undefined, which
   * is strictly equal to the original undefined values.
   */
  test('JSON round-trip preserves all five fields with strict equality for question cards', () => {
    fc.assert(
      fc.property(arbQuestionCard, (card) => {
        const roundTripped = JSON.parse(JSON.stringify(card)) as Card;

        expect(roundTripped.title).toBe(card.title);
        // Optional fields: undefined === undefined
        expect(roundTripped.location).toBe(card.location);
        expect(roundTripped.baseDuration).toBe(card.baseDuration);
        expect(roundTripped.price).toBe(card.price);
        expect(roundTripped.priority).toBe(card.priority);
      }),
      { numRuns: 100 }
    );
  });
});
