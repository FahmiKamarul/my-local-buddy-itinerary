// Feature: my-buddy-itinerary-planner, Property 1: destination validation exhaustive

/**
 * Property 1: Destination Validation is Exhaustive
 * Validates: Requirements 1.2, 1.3, 1.4
 *
 * For any string input, isRecognisedLocation SHALL accept it if and only if:
 *   - it matches an entry in RECOGNISED_LOCATIONS (case-insensitive), AND
 *   - it contains between 1 and 100 non-whitespace characters.
 * It SHALL reject all other strings, including empty strings and whitespace-only strings.
 */

import * as fc from 'fast-check';
import { isRecognisedLocation, RECOGNISED_LOCATIONS } from '../locations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count non-whitespace characters in a string (mirrors the implementation). */
function nonWhitespaceCount(s: string): number {
  return s.trim().replace(/\s/g, '').length;
}

/** Return a random case variation of a string (upper / lower / mixed). */
function caseVariant(s: string, variant: 'upper' | 'lower' | 'mixed'): string {
  if (variant === 'upper') return s.toUpperCase();
  if (variant === 'lower') return s.toLowerCase();
  // mixed: alternate character case
  return s
    .split('')
    .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
    .join('');
}

// ---------------------------------------------------------------------------
// Test 1 — Arbitrary strings that are NOT in RECOGNISED_LOCATIONS → false
// ---------------------------------------------------------------------------

describe('Property 1: Destination Validation is Exhaustive', () => {
  const recognisedSet = new Set(RECOGNISED_LOCATIONS.map((l) => l.toLowerCase()));

  test('Test 1: arbitrary non-recognised strings are rejected', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary strings; filter out any that happen to match a
        // recognised location (case-insensitive) so we only test non-matches.
        fc.string({ minLength: 0, maxLength: 200 }).filter(
          (s) => !recognisedSet.has(s.trim().toLowerCase()),
        ),
        (input) => {
          const result = isRecognisedLocation(input);
          return result === false;
        },
      ),
      { numRuns: 200 },
    );
  });

  // ---------------------------------------------------------------------------
  // Test 2 — Recognised locations in all case variants → true
  // ---------------------------------------------------------------------------

  test('Test 2: recognised locations accepted regardless of case', () => {
    const variants: Array<'upper' | 'lower' | 'mixed'> = ['upper', 'lower', 'mixed'];

    fc.assert(
      fc.property(
        fc.constantFrom(...RECOGNISED_LOCATIONS),
        fc.constantFrom(...variants),
        (location, variant) => {
          const input = caseVariant(location, variant);
          return isRecognisedLocation(input) === true;
        },
      ),
      { numRuns: 300 },
    );
  });

  // ---------------------------------------------------------------------------
  // Test 3 — Empty strings and whitespace-only strings → false
  // ---------------------------------------------------------------------------

  test('Test 3: empty strings and whitespace-only strings are rejected', () => {
    // Empty string
    expect(isRecognisedLocation('')).toBe(false);

    fc.assert(
      fc.property(
        // Generate strings composed only of whitespace characters (spaces and tabs)
        fc.stringMatching(/^[ \t\n\r]+$/).filter((s) => s.length >= 1 && s.length <= 50),
        (whitespaceOnly) => {
          return isRecognisedLocation(whitespaceOnly) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Test 4 — Strings with > 100 non-whitespace chars → false
  // ---------------------------------------------------------------------------

  test('Test 4: strings with more than 100 non-whitespace characters are rejected', () => {
    fc.assert(
      fc.property(
        // Generate strings whose non-whitespace character count exceeds 100.
        // Use printable ASCII letters/digits to keep it simple.
        fc
          .string({ minLength: 101, maxLength: 200 })
          .map((s) => s.replace(/\s/g, 'x')) // ensure no whitespace so count === length
          .filter((s) => nonWhitespaceCount(s) > 100),
        (longInput) => {
          return isRecognisedLocation(longInput) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Additional edge-case: recognised location with leading/trailing whitespace
  // The implementation trims before matching, so these should still be accepted.
  // ---------------------------------------------------------------------------

  test('Test 5 (edge case): recognised locations with surrounding whitespace are accepted', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RECOGNISED_LOCATIONS),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        (location, leadingSpaces, trailingSpaces) => {
          const input = ' '.repeat(leadingSpaces) + location + ' '.repeat(trailingSpaces);
          // Only valid if the non-whitespace count is still within 1–100
          const nwCount = nonWhitespaceCount(input);
          if (nwCount >= 1 && nwCount <= 100) {
            return isRecognisedLocation(input) === true;
          }
          return true; // skip if somehow out of range
        },
      ),
      { numRuns: 100 },
    );
  });
});
