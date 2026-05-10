/**
 * Tests for search-google-places tool
 *
 * Covers:
 * - Task 8.1: Property-based tests for input schema validation
 * - Task 8.2: Unit tests for buildRequestBody (already in build-request-body.test.ts)
 * - Task 8.3: Unit tests for mapPlaceResponse (already in map-place-response.test.ts)
 * - Task 8.4: Unit tests for error handling (missing API key, API error, malformed response)
 * - Task 8.5: Property test: output length never exceeds maxResults
 */

import * as fc from 'fast-check';
import {
  SearchGooglePlacesInputSchema,
  GooglePlaceSchema,
  execute,
  mapPlaceResponse,
  type SearchGooglePlacesInput,
} from '../search-google-places';

// ---------------------------------------------------------------------------
// Task 8.1: Property-based tests for input schema validation
// ---------------------------------------------------------------------------

describe('SearchGooglePlacesInputSchema — property-based validation', () => {
  // Arbitrary for valid input
  const arbValidInput = fc.record({
    query: fc.string({ minLength: 1, maxLength: 200 }),
    maxResults: fc.integer({ min: 1, max: 10 }),
    locationBias: fc.option(
      fc.record({
        latitude: fc.double({ min: -90, max: 90, noNaN: true }),
        longitude: fc.double({ min: -180, max: 180, noNaN: true }),
        radiusMeters: fc.integer({ min: 100, max: 50000 }),
      }),
      { nil: undefined }
    ),
  });

  test('valid inputs always parse successfully', () => {
    fc.assert(
      fc.property(arbValidInput, (input) => {
        const result = SearchGooglePlacesInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('empty query string fails validation', () => {
    const result = SearchGooglePlacesInputSchema.safeParse({
      query: '',
      maxResults: 5,
    });
    expect(result.success).toBe(false);
  });

  test('query exceeding 200 characters fails validation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 201, maxLength: 300 }),
        (longQuery) => {
          const result = SearchGooglePlacesInputSchema.safeParse({
            query: longQuery,
            maxResults: 5,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('maxResults below 1 fails validation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 0 }),
        (badMax) => {
          const result = SearchGooglePlacesInputSchema.safeParse({
            query: 'test',
            maxResults: badMax,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('maxResults above 10 fails validation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 11, max: 100 }),
        (badMax) => {
          const result = SearchGooglePlacesInputSchema.safeParse({
            query: 'test',
            maxResults: badMax,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('locationBias latitude out of bounds fails validation', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ min: 91, max: 1000, noNaN: true }),
          fc.double({ min: -1000, max: -91, noNaN: true })
        ),
        (badLat) => {
          const result = SearchGooglePlacesInputSchema.safeParse({
            query: 'test',
            maxResults: 5,
            locationBias: {
              latitude: badLat,
              longitude: 102.0,
              radiusMeters: 5000,
            },
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('locationBias longitude out of bounds fails validation', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ min: 181, max: 1000, noNaN: true }),
          fc.double({ min: -1000, max: -181, noNaN: true })
        ),
        (badLng) => {
          const result = SearchGooglePlacesInputSchema.safeParse({
            query: 'test',
            maxResults: 5,
            locationBias: {
              latitude: 2.0,
              longitude: badLng,
              radiusMeters: 5000,
            },
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('locationBias radiusMeters below 100 fails validation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        (badRadius) => {
          const result = SearchGooglePlacesInputSchema.safeParse({
            query: 'test',
            maxResults: 5,
            locationBias: {
              latitude: 2.0,
              longitude: 102.0,
              radiusMeters: badRadius,
            },
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('locationBias radiusMeters above 50000 fails validation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50001, max: 100000 }),
        (badRadius) => {
          const result = SearchGooglePlacesInputSchema.safeParse({
            query: 'test',
            maxResults: 5,
            locationBias: {
              latitude: 2.0,
              longitude: 102.0,
              radiusMeters: badRadius,
            },
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('maxResults defaults to 5 when not provided', () => {
    const result = SearchGooglePlacesInputSchema.safeParse({
      query: 'nasi lemak',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxResults).toBe(5);
    }
  });
});

// ---------------------------------------------------------------------------
// Task 8.4: Unit tests for error handling
// ---------------------------------------------------------------------------

describe('execute — error handling', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('returns empty array when GOOGLE_PLACES_API_KEY is not set', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;

    const result = await execute({
      query: 'restaurants in Melaka',
      maxResults: 5,
    });

    expect(result).toEqual([]);
  });

  test('returns empty array when API returns non-OK HTTP status', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }) as unknown as typeof fetch;

    const result = await execute({
      query: 'restaurants in Melaka',
      maxResults: 5,
    });

    expect(result).toEqual([]);
  });

  test('returns empty array when API returns 500 Internal Server Error', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }) as unknown as typeof fetch;

    const result = await execute({
      query: 'cafes',
      maxResults: 3,
    });

    expect(result).toEqual([]);
  });

  test('returns empty array when fetch throws a network error', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';

    global.fetch = jest.fn().mockRejectedValue(
      new Error('Network error')
    ) as unknown as typeof fetch;

    const result = await execute({
      query: 'museums',
      maxResults: 5,
    });

    expect(result).toEqual([]);
  });

  test('returns empty array when response JSON is malformed', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    }) as unknown as typeof fetch;

    const result = await execute({
      query: 'parks',
      maxResults: 5,
    });

    expect(result).toEqual([]);
  });

  test('returns empty array when response has no places field', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch;

    const result = await execute({
      query: 'hotels',
      maxResults: 5,
    });

    expect(result).toEqual([]);
  });

  test('successfully maps valid API response', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';

    const mockPlaces = [
      {
        id: 'place-1',
        displayName: { text: 'Jonker Street' },
        formattedAddress: 'Jalan Hang Jebat, Melaka',
        location: { latitude: 2.1946, longitude: 102.2478 },
        rating: 4.5,
        userRatingCount: 500,
        types: ['tourist_attraction'],
        currentOpeningHours: { openNow: true },
      },
      {
        id: 'place-2',
        displayName: { text: 'A Famosa' },
        formattedAddress: 'Jalan Parameswara, Melaka',
        location: { latitude: 2.1912, longitude: 102.2488 },
        rating: 4.2,
        types: ['historical_landmark'],
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ places: mockPlaces }),
    }) as unknown as typeof fetch;

    const result = await execute({
      query: 'attractions in Melaka',
      maxResults: 5,
    });

    expect(result).toHaveLength(2);
    expect(result[0].placeId).toBe('place-1');
    expect(result[0].name).toBe('Jonker Street');
    expect(result[0].openNow).toBe(true);
    expect(result[1].placeId).toBe('place-2');
    expect(result[1].name).toBe('A Famosa');
    expect(result[1].openNow).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Task 8.5: Property test — output length never exceeds maxResults
// ---------------------------------------------------------------------------

describe('execute — output length property', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('output length never exceeds maxResults for any valid input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 20 }),
        async (maxResults, apiReturnCount) => {
          // Generate mock places from the API (could be more than maxResults)
          const mockPlaces = Array.from({ length: apiReturnCount }, (_, i) => ({
            id: `place-${i}`,
            displayName: { text: `Place ${i}` },
            formattedAddress: `Address ${i}`,
            location: { latitude: 2.0 + i * 0.01, longitude: 102.0 + i * 0.01 },
            types: ['restaurant'],
          }));

          global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ places: mockPlaces }),
          }) as unknown as typeof fetch;

          const result = await execute({
            query: 'food',
            maxResults,
          });

          expect(result.length).toBeLessThanOrEqual(maxResults);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------
// GooglePlaceSchema validation
// ---------------------------------------------------------------------------

describe('GooglePlaceSchema — validation', () => {
  test('valid GooglePlace objects parse successfully', () => {
    const validPlace = {
      placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      name: 'Test Place',
      formattedAddress: '123 Street',
      location: { latitude: 2.0, longitude: 102.0 },
      types: ['restaurant'],
    };

    const result = GooglePlaceSchema.safeParse(validPlace);
    expect(result.success).toBe(true);
  });

  test('missing required fields fail validation', () => {
    const missingPlaceId = {
      name: 'Test',
      formattedAddress: '123 Street',
      location: { latitude: 2.0, longitude: 102.0 },
      types: [],
    };
    expect(GooglePlaceSchema.safeParse(missingPlaceId).success).toBe(false);

    const missingName = {
      placeId: 'id',
      formattedAddress: '123 Street',
      location: { latitude: 2.0, longitude: 102.0 },
      types: [],
    };
    expect(GooglePlaceSchema.safeParse(missingName).success).toBe(false);

    const missingLocation = {
      placeId: 'id',
      name: 'Test',
      formattedAddress: '123 Street',
      types: [],
    };
    expect(GooglePlaceSchema.safeParse(missingLocation).success).toBe(false);
  });

  test('invalid priceLevel enum value fails validation', () => {
    const badPrice = {
      placeId: 'id',
      name: 'Test',
      formattedAddress: '123 Street',
      location: { latitude: 2.0, longitude: 102.0 },
      types: [],
      priceLevel: 'CHEAP',
    };
    expect(GooglePlaceSchema.safeParse(badPrice).success).toBe(false);
  });
});
