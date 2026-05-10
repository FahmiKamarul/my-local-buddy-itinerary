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
 * Returns true if the input matches a recognised Malaysian location.
 *
 * Matching rules:
 * - Case-insensitive, leading/trailing whitespace is trimmed.
 * - Input must contain between 1 and 100 non-whitespace characters (Requirement 1.2).
 */
export function isRecognisedLocation(input: string): boolean {
  const trimmed = input.trim();

  // Validate non-whitespace character count (1–100)
  const nonWhitespaceCount = trimmed.replace(/\s/g, '').length;
  if (nonWhitespaceCount < 1 || nonWhitespaceCount > 100) {
    return false;
  }

  const normalised = trimmed.toLowerCase();
  return RECOGNISED_LOCATIONS.some(loc => loc.toLowerCase() === normalised);
}
