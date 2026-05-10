/**
 * search_google_places — Vercel AI SDK Tool
 *
 * Searches the Google Places API (New) Text Search endpoint for places
 * in Malaysia. Returns structured place data including name, address,
 * location, rating, and price level.
 *
 * Validates: Requirements 1.1, 2.1, 2.2, 2.3, 2.4, 3.1, 3.4, 3.5
 */

import { tool } from 'ai';
import { z } from 'zod';

// --- Input Schema (what the LLM provides) ---
export const SearchGooglePlacesInputSchema = z.object({
  query: z.string().min(1).max(200).describe(
    'Text search query for places, e.g. "best nasi lemak in Melaka" or "museums near Jonker Street"'
  ),
  locationBias: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().min(100).max(50000).default(5000),
  }).optional().describe(
    'Optional geographic bias to prefer results near a location'
  ),
  maxResults: z.number().int().min(1).max(10).default(5).describe(
    'Maximum number of places to return (1-10)'
  ),
});

export type SearchGooglePlacesInput = z.infer<typeof SearchGooglePlacesInputSchema>;

// --- Output Schema (what the tool returns to the LLM) ---
export const GooglePlaceSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  formattedAddress: z.string(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  priceLevel: z.enum([
    'PRICE_LEVEL_FREE',
    'PRICE_LEVEL_INEXPENSIVE',
    'PRICE_LEVEL_MODERATE',
    'PRICE_LEVEL_EXPENSIVE',
    'PRICE_LEVEL_VERY_EXPENSIVE',
  ]).optional(),
  types: z.array(z.string()),
  openNow: z.boolean().optional(),
  primaryType: z.string().optional(),
  editorialSummary: z.string().optional(),
  photoUrl: z.string().optional(),
});

export type GooglePlace = z.infer<typeof GooglePlaceSchema>;

// --- Request Body Builder ---

/**
 * Constructs the Google Places Text Search API request body from validated input.
 *
 * - Sets `textQuery` to input.query
 * - Sets `maxResultCount` to input.maxResults
 * - Sets `languageCode` to "ms" (Malay) for hyperlocal Malaysian results
 * - Includes `locationBias.circle` when locationBias is provided
 */
export function buildRequestBody(input: SearchGooglePlacesInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    textQuery: input.query,
    maxResultCount: input.maxResults,
    languageCode: 'ms',
  };

  if (input.locationBias) {
    body.locationBias = {
      circle: {
        center: {
          latitude: input.locationBias.latitude,
          longitude: input.locationBias.longitude,
        },
        radius: input.locationBias.radiusMeters,
      },
    };
  }

  return body;
}

// --- Response Mapper ---

/**
 * Maps a raw Google Places API place object to the GooglePlace schema.
 *
 * - Maps `apiPlace.id` → `placeId`
 * - Maps `apiPlace.displayName.text` → `name` (defaults to 'Unknown')
 * - Maps `apiPlace.formattedAddress` → `formattedAddress` (defaults to '')
 * - Maps `apiPlace.location` → `location` (latitude/longitude)
 * - Maps `apiPlace.currentOpeningHours.openNow` → `openNow`
 * - Maps `apiPlace.editorialSummary.text` → `editorialSummary`
 * - Defaults `types` to empty array if not present
 * - Includes optional fields only when present in API response
 *
 * Validates: Requirements 4.1, 4.3
 */
export function mapPlaceResponse(apiPlace: Record<string, unknown>): GooglePlace {
  const displayName = apiPlace.displayName as { text?: string } | undefined;
  const location = apiPlace.location as { latitude: number; longitude: number } | undefined;
  const currentOpeningHours = apiPlace.currentOpeningHours as { openNow?: boolean } | undefined;
  const editorialSummary = apiPlace.editorialSummary as { text?: string } | undefined;
  const photos = apiPlace.photos as Array<{ name?: string }> | undefined;

  // Build photo URL using our own proxy route (avoids CORS and API key exposure)
  let photoUrl: string | undefined;
  if (photos && photos.length > 0 && photos[0].name) {
    // Encode the photo resource name for use in our proxy
    photoUrl = `/api/place-photo?ref=${encodeURIComponent(photos[0].name)}`;
  }

  return {
    placeId: apiPlace.id as string,
    name: displayName?.text ?? 'Unknown',
    formattedAddress: (apiPlace.formattedAddress as string) ?? '',
    location: {
      latitude: location?.latitude ?? 0,
      longitude: location?.longitude ?? 0,
    },
    rating: apiPlace.rating as number | undefined,
    userRatingCount: apiPlace.userRatingCount as number | undefined,
    priceLevel: apiPlace.priceLevel as GooglePlace['priceLevel'],
    types: (apiPlace.types as string[]) ?? [],
    openNow: currentOpeningHours?.openNow,
    primaryType: apiPlace.primaryType as string | undefined,
    editorialSummary: editorialSummary?.text,
    photoUrl,
  };
}

// --- Execute Function ---

/**
 * Main execute function for the searchGooglePlaces tool.
 *
 * Retrieves the API key from environment, calls the Google Places Text Search
 * (New) API, and returns mapped results. Never throws — returns empty array
 * on any error.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 4.2, 5.1, 5.2, 5.3, 5.4
 */
export async function execute(input: SearchGooglePlacesInput): Promise<GooglePlace[]> {
  try {
    const t0 = performance.now();

    // Step 1: Retrieve API key from environment
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not configured');
      return [];
    }

    // Step 2: Build the request body
    const requestBody = buildRequestBody(input);

    // Step 3: Call Google Places Text Search (New) API
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': [
            'places.id',
            'places.displayName',
            'places.formattedAddress',
            'places.location',
            'places.rating',
            'places.userRatingCount',
            'places.priceLevel',
            'places.types',
            'places.currentOpeningHours',
            'places.primaryType',
            'places.editorialSummary',
            'places.photos',
          ].join(','),
        },
        body: JSON.stringify(requestBody),
      }
    );

    // Step 4: Handle API errors gracefully
    if (!response.ok) {
      console.error(`Google Places API error: ${response.status} ${response.statusText}`);
      return [];
    }

    // Step 5: Parse response and map results
    const data = await response.json();
    const places: GooglePlace[] = (data.places ?? [])
      .slice(0, input.maxResults)
      .map(mapPlaceResponse);

    console.log(`[google-places] "${input.query}" → ${places.length} results in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    return places;
  } catch (error) {
    console.error('Google Places tool error:', error);
    return [];
  }
}


// --- Tool Definition (Vercel AI SDK) ---

/**
 * Vercel AI SDK tool definition for searching Google Places.
 * The LLM calls this tool to find places in Malaysia with structured data output.
 */
export const searchGooglePlacesTool = tool<SearchGooglePlacesInput, GooglePlace[]>({
  description:
    'Search for places in Malaysia using Google Places API. ' +
    'Returns structured place data including name, address, coordinates, ' +
    'rating, price level, opening status, and a photo URL. ' +
    'Use this to find attractions, restaurants, cafes, and activities for itinerary planning.',

  inputSchema: SearchGooglePlacesInputSchema,

  execute,
});
