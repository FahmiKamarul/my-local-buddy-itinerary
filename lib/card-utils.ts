import { Card } from './schemas';

// ---------------------------------------------------------------------------
// validateCardRoundTrip
// Serialises a Card via JSON.stringify then deserialises via JSON.parse and
// compares the five key fields with strict equality.
// Logs a warning with the card title if any field mismatches.
// Returns true if all fields survive the round-trip intact.
// Validates: Requirements 10.3, 10.4
// ---------------------------------------------------------------------------
export function validateCardRoundTrip(card: Card): boolean {
  const serialised = JSON.stringify(card);
  const deserialised = JSON.parse(serialised) as Card;

  const fields: (keyof Card)[] = [
    'title',
    'location',
    'baseDuration',
    'price',
    'priority',
  ];

  for (const field of fields) {
    if (card[field] !== deserialised[field]) {
      console.warn(
        `Card round-trip check failed for card "${card.title}": field "${field}" mismatch`
      );
      return false;
    }
  }

  return true;
}
