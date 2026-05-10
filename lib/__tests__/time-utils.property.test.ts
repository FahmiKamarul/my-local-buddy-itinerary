// Feature: my-buddy-itinerary-planner, Property 13: time window validation

/**
 * Property 13: Time Window Validation
 * Validates: Requirements 6.3, 6.4
 *
 * For any pair of time strings (arrivalTime, departureTime), the time window
 * validation function SHALL return an error if arrivalTime >= departureTime OR
 * if the difference departureTime − arrivalTime is less than 30 minutes; it
 * SHALL return success only when departureTime − arrivalTime >= 30 minutes.
 */

import * as fc from 'fast-check';
import { validateTimeWindow, formatHHMM, parseHHMM } from '../time-utils';

describe('Property 13: Time Window Validation', () => {
  /**
   * Test 1: Valid pairs (gap >= 30 min) → validateTimeWindow returns { valid: true }
   *
   * Strategy: generate arrivalMinutes in [0, 1409] and a gap in [30, 1439 - arrivalMinutes],
   * so that departureMinutes = arrivalMinutes + gap is always within [0, 1439] and gap >= 30.
   */
  it('returns { valid: true } for any pair where departure − arrival >= 30 minutes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1409 }),
        fc.integer({ min: 30, max: 1439 }),
        (arrivalMinutes, gap) => {
          const departureMinutes = arrivalMinutes + gap;
          // Skip if departure would exceed 1439 (23:59)
          fc.pre(departureMinutes <= 1439);

          const arrival = formatHHMM(arrivalMinutes);
          const departure = formatHHMM(departureMinutes);

          const result = validateTimeWindow(arrival, departure);
          return result.valid === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test 2: Pairs where arrival >= departure → validateTimeWindow returns { valid: false }
   *
   * Strategy: generate two independent minute values and ensure arrival >= departure.
   * Covers both equal times and arrival strictly after departure.
   */
  it('returns { valid: false } when arrival >= departure', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1439 }),
        fc.integer({ min: 0, max: 1439 }),
        (a, b) => {
          // Ensure arrival >= departure
          const arrivalMinutes = Math.max(a, b);
          const departureMinutes = Math.min(a, b);

          // Only test cases where arrival >= departure
          fc.pre(arrivalMinutes >= departureMinutes);

          const arrival = formatHHMM(arrivalMinutes);
          const departure = formatHHMM(departureMinutes);

          const result = validateTimeWindow(arrival, departure);
          return result.valid === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test 3: Pairs where gap < 30 min (but departure > arrival) → validateTimeWindow returns { valid: false }
   *
   * Strategy: generate arrivalMinutes in [0, 1438] and a gap in [1, 29],
   * ensuring departure > arrival but gap < 30.
   */
  it('returns { valid: false } when departure − arrival < 30 minutes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1438 }),
        fc.integer({ min: 1, max: 29 }),
        (arrivalMinutes, gap) => {
          const departureMinutes = arrivalMinutes + gap;
          // Skip if departure would exceed 1439 (23:59)
          fc.pre(departureMinutes <= 1439);

          const arrival = formatHHMM(arrivalMinutes);
          const departure = formatHHMM(departureMinutes);

          const result = validateTimeWindow(arrival, departure);
          return result.valid === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});
