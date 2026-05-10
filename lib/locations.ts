export const RECOGNISED_LOCATIONS: string[] = [
  'Melaka', 'Malacca',
  'Kuala Lumpur', 'KL',
  'Penang', 'George Town',
  'Johor Bahru', 'JB',
  'Ipoh',
  'Kota Kinabalu',
  'Kuching',
  'Shah Alam',
  'Petaling Jaya',
  'Subang Jaya',
  // ... expandable list
];

/**
 * Returns true if the input is a valid location string.
 *
 * Accepts any non-empty string up to 100 non-whitespace characters.
 * Previously restricted to a whitelist — now open to all destinations
 * since Google Places handles validation of real places.
 */
export function isRecognisedLocation(input: string): boolean {
  const trimmed = input.trim();

  // Validate non-whitespace character count (1–100)
  const nonWhitespaceCount = trimmed.replace(/\s/g, '').length;
  if (nonWhitespaceCount < 1 || nonWhitespaceCount > 100) {
    return false;
  }

  return true;
}
