/**
 * Time utility helpers for MY Buddy Itinerary Planner.
 * Handles HH:MM parsing, formatting, arithmetic, and time window validation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeValidationResult =
  | { valid: true }
  | { valid: false; error: string };

// ---------------------------------------------------------------------------
// parseHHMM
// ---------------------------------------------------------------------------

/**
 * Converts a HH:MM string to minutes since midnight.
 *
 * @example
 * parseHHMM("09:30") // → 570  (9 * 60 + 30)
 * parseHHMM("00:00") // → 0
 * parseHHMM("23:59") // → 1439
 *
 * @throws {Error} if the string is not a valid HH:MM value
 */
export function parseHHMM(time: string): number {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`Invalid time format: "${time}". Expected HH:MM.`);
  }

  const hours = parseInt(time.slice(0, 2), 10);
  const minutes = parseInt(time.slice(3, 5), 10);

  if (hours > 23 || minutes > 59) {
    throw new Error(
      `Invalid time value: "${time}". Hours must be 0–23 and minutes 0–59.`
    );
  }

  return hours * 60 + minutes;
}

// ---------------------------------------------------------------------------
// formatHHMM
// ---------------------------------------------------------------------------

/**
 * Converts minutes since midnight to a zero-padded HH:MM string.
 * Wraps around midnight automatically (e.g. 1500 → "01:00").
 *
 * @example
 * formatHHMM(570)  // → "09:30"
 * formatHHMM(0)    // → "00:00"
 * formatHHMM(1439) // → "23:59"
 * formatHHMM(1500) // → "01:00"  (midnight crossing)
 */
export function formatHHMM(minutes: number): string {
  // Normalise to [0, 1440) to handle midnight crossing
  const normalised = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalised / 60);
  const m = normalised % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// addMinutes
// ---------------------------------------------------------------------------

/**
 * Adds a number of minutes to a HH:MM time string and returns the result
 * as a HH:MM string. Handles midnight crossing.
 *
 * @example
 * addMinutes("09:30", 45)  // → "10:15"
 * addMinutes("23:45", 30)  // → "00:15"  (midnight crossing)
 * addMinutes("10:00", -30) // → "09:30"  (negative offset)
 */
export function addMinutes(time: string, minutes: number): string {
  const base = parseHHMM(time);
  return formatHHMM(base + minutes);
}

// ---------------------------------------------------------------------------
// validateTimeWindow
// ---------------------------------------------------------------------------

/**
 * Validates that a (arrival, departure) time window is usable for itinerary
 * generation:
 *   - departure must be strictly after arrival
 *   - the gap must be at least 30 minutes
 *
 * Returns `{ valid: true }` on success, or `{ valid: false, error: string }`
 * with a Malaysian-English error message on failure.
 *
 * @example
 * validateTimeWindow("09:00", "18:00") // → { valid: true }
 * validateTimeWindow("09:00", "09:20") // → { valid: false, error: "Aiyoh, ..." }
 * validateTimeWindow("18:00", "09:00") // → { valid: false, error: "Aiyoh, ..." }
 */
export function validateTimeWindow(
  arrival: string,
  departure: string
): TimeValidationResult {
  let arrivalMinutes: number;
  let departureMinutes: number;

  try {
    arrivalMinutes = parseHHMM(arrival);
  } catch {
    return {
      valid: false,
      error: `Aiyoh, the arrival time "${arrival}" doesn't look right lah! Please use HH:MM format.`,
    };
  }

  try {
    departureMinutes = parseHHMM(departure);
  } catch {
    return {
      valid: false,
      error: `Aiyoh, the departure time "${departure}" doesn't look right lah! Please use HH:MM format.`,
    };
  }

  if (arrivalMinutes >= departureMinutes) {
    return {
      valid: false,
      error:
        "Aiyoh, departure time must be later than arrival time lah! Cannot go back in time one.",
    };
  }

  const gap = departureMinutes - arrivalMinutes;

  if (gap < 30) {
    return {
      valid: false,
      error:
        "Aiyoh, departure time must be at least 30 minutes after arrival lah! Give us a bit more time to plan your trip boleh?",
    };
  }

  return { valid: true };
}
