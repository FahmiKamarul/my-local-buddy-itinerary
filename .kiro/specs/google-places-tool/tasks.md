# Tasks: Google Places Tool

## Task 1: Create Zod Schemas and Types

- [x] 1.1 Create `lib/tools/search-google-places.ts` with the input schema (`SearchGooglePlacesInputSchema`) defining `query` (string, min 1, max 200), optional `locationBias` (lat/lng/radius with bounds), and `maxResults` (int 1-10, default 5)
- [x] 1.2 Define the output type `GooglePlaceSchema` with required fields (`placeId`, `name`, `formattedAddress`, `location`) and optional fields (`rating`, `userRatingCount`, `priceLevel`, `types`, `openNow`, `primaryType`, `editorialSummary`)
- [x] 1.3 Export TypeScript types `SearchGooglePlacesInput` and `GooglePlace` inferred from the Zod schemas

## Task 2: Implement Request Builder

- [x] 2.1 Implement `buildRequestBody` function that constructs the Google Places Text Search API request body from validated input
- [x] 2.2 Set `languageCode` to `"ms"` in all requests for hyperlocal Malaysian results
- [x] 2.3 Include `locationBias.circle` in the request body when `locationBias` is provided in input

## Task 3: Implement Response Mapper

- [x] 3.1 Implement `mapPlaceResponse` function that maps raw Google Places API response fields to the `GooglePlace` schema
- [x] 3.2 Map `displayName.text` → `name`, `id` → `placeId`, `currentOpeningHours.openNow` → `openNow`, `editorialSummary.text` → `editorialSummary`
- [x] 3.3 Default `types` to empty array and handle missing optional fields gracefully

## Task 4: Implement Tool Execute Function

- [x] 4.1 Implement the main `execute` function that retrieves `GOOGLE_PLACES_API_KEY` from environment, calls the API, and returns mapped results
- [x] 4.2 Call `POST https://places.googleapis.com/v1/places:searchText` with `X-Goog-Api-Key` and `X-Goog-FieldMask` headers
- [x] 4.3 Set `X-Goog-FieldMask` to include all required fields: `places.id`, `places.displayName`, `places.formattedAddress`, `places.location`, `places.rating`, `places.userRatingCount`, `places.priceLevel`, `places.types`, `places.currentOpeningHours`, `places.primaryType`, `places.editorialSummary`
- [x] 4.4 Slice API results to respect `maxResults` limit

## Task 5: Implement Error Handling

- [x] 5.1 Return empty array when `GOOGLE_PLACES_API_KEY` is not set (log error, don't throw)
- [x] 5.2 Return empty array when API returns non-OK HTTP status (log error, don't throw)
- [x] 5.3 Wrap entire execute function in try/catch to ensure it never throws to the LLM

## Task 6: Export Tool Definition

- [x] 6.1 Export `searchGooglePlacesTool` using Vercel AI SDK `tool()` with description, `inputSchema` (input schema), and `execute` function
- [x] 6.2 Add tool description that communicates purpose to the LLM: searching for places in Malaysia with structured place data output

## Task 7: Environment Configuration

- [x] 7.1 Add `GOOGLE_PLACES_API_KEY` to `.env.example` with a comment explaining its purpose
- [x] 7.2 Update `README.md` environment variables section to document `GOOGLE_PLACES_API_KEY`

## Task 8: Write Tests

- [x] 8.1 Write property-based tests for input schema validation (valid/invalid queries, locationBias bounds, maxResults bounds)
- [x] 8.2 Write unit tests for `buildRequestBody` verifying correct request structure with and without locationBias
- [x] 8.3 Write unit tests for `mapPlaceResponse` verifying correct field mapping from API response format
- [x] 8.4 Write unit tests for error handling: missing API key returns [], API error returns [], malformed response returns []
- [x] 8.5 Write property test: output length never exceeds maxResults for any valid input
