// Feature: my-buddy-itinerary-planner, Property 1: destination validation exhaustive

/**
 * Property 1: Destination Validation is Exhaustive
 * Validates: Requirements 1.2, 1.3, 1.4
 *
 * For any string input, isRecognisedLocation SHALL accept it if and only if:
 *   - it contains between 1 and 100 non-whitespace characters (after trimming).
 * It SHALL reject empty strings, whitespace-only strings, and strings exceeding 100 non-whitespace chars.
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
// Tests
// ---------------------------------------------------------------------------

describe('Property 1: Destination Validation is Exhaustive', () => {

  test('Test 1: any non-empty string with 1-100 non-whitespace chars is accepted', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(
          (s) => {
            const nwc = nonWhitespaceCount(s);
            return nwc >= 1 && nwc <= 100;
          },
        ),
        (input) => {
          return isRecognisedLocation(input) === true;
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
  // Test 5 — recognised location with leading/trailing whitespace still accepted
  // ---------------------------------------------------------------------------

  test('Test 5 (edge case): recognised locations with surrounding whitespace are accepted', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RECOGNISED_LOCATIONS),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        (location, leadingSpaces, trailingSpaces) => {
          const input = ' '.repeat(leadingSpaces) + location + ' '.repeat(trailingSpaces);
          const nwCount = nonWhitespaceCount(input);
          if (nwCount >= 1 && nwCount <= 100) {
            return isRecognisedLocation(input) === true;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
