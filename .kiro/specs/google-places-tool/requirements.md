# Requirements: Google Places Tool

## Requirement 1: Tool Definition and Registration

### 1.1 Vercel AI SDK Tool Pattern
The tool MUST be defined using the Vercel AI SDK `tool()` function, exported as `searchGooglePlacesTool` from `lib/tools/search-google-places.ts`.

### 1.2 Tool Description
The tool MUST include a description string that clearly communicates its purpose to the LLM: searching for places in Malaysia and returning structured place data.

### 1.3 Tool Naming Convention
The tool MUST be registered with the snake_case name `search_google_places` when added to the tools object in route handlers.

---

## Requirement 2: Input Schema Validation

### 2.1 Query Parameter
The tool MUST accept a `query` parameter of type string with minimum length 1 and maximum length 200 characters.

### 2.2 Location Bias Parameter
The tool MUST accept an optional `locationBias` parameter containing:
- `latitude`: number between -90 and 90
- `longitude`: number between -180 and 180
- `radiusMeters`: number between 100 and 50000, defaulting to 5000

### 2.3 Max Results Parameter
The tool MUST accept an optional `maxResults` parameter as an integer between 1 and 10, defaulting to 5.

### 2.4 Zod Schema Validation
All input parameters MUST be validated using Zod schemas before the execute function runs.

---

## Requirement 3: Google Places API Integration

### 3.1 API Endpoint
The tool MUST call the Google Places API (New) Text Search endpoint via POST to `https://places.googleapis.com/v1/places:searchText`.

### 3.2 API Key Authentication
The tool MUST authenticate using the `GOOGLE_PLACES_API_KEY` environment variable passed via the `X-Goog-Api-Key` header.

### 3.3 Field Mask
The tool MUST request only the following fields via `X-Goog-FieldMask`: `places.id`, `places.displayName`, `places.formattedAddress`, `places.location`, `places.rating`, `places.userRatingCount`, `places.priceLevel`, `places.types`, `places.currentOpeningHours`, `places.primaryType`, `places.editorialSummary`.

### 3.4 Language Code
The tool MUST set `languageCode` to `"ms"` (Malay) in the request body for hyperlocal Malaysian results.

### 3.5 Location Bias in Request
When `locationBias` is provided in the input, the tool MUST include a `locationBias.circle` object in the request body with the specified center and radius.

---

## Requirement 4: Output Schema and Response Mapping

### 4.1 Output Structure
The tool MUST return an array of `GooglePlace` objects, each containing:
- `placeId` (string, required)
- `name` (string, required)
- `formattedAddress` (string, required)
- `location` (object with `latitude` and `longitude`, required)
- `rating` (number, optional)
- `userRatingCount` (number, optional)
- `priceLevel` (enum string, optional)
- `types` (string array, required — defaults to empty array)
- `openNow` (boolean, optional)
- `primaryType` (string, optional)
- `editorialSummary` (string, optional)

### 4.2 Result Count Limit
The tool MUST return at most `maxResults` places (slicing the API response if needed).

### 4.3 Field Mapping
The tool MUST map Google Places API response fields to the output schema:
- `apiPlace.id` → `placeId`
- `apiPlace.displayName.text` → `name`
- `apiPlace.formattedAddress` → `formattedAddress`
- `apiPlace.location` → `location`
- `apiPlace.currentOpeningHours.openNow` → `openNow`
- `apiPlace.editorialSummary.text` → `editorialSummary`

---

## Requirement 5: Error Handling and Resilience

### 5.1 Missing API Key
If `GOOGLE_PLACES_API_KEY` is not set, the tool MUST log an error and return an empty array (never throw).

### 5.2 API Error Response
If the Google Places API returns a non-OK HTTP status, the tool MUST log the error and return an empty array.

### 5.3 No Results
If the API returns no places, the tool MUST return an empty array.

### 5.4 Never Throw to LLM
The tool's execute function MUST never throw an exception. All errors MUST be caught and result in an empty array return.

---

## Requirement 6: Environment Configuration

### 6.1 Environment Variable
The project MUST use `GOOGLE_PLACES_API_KEY` as the environment variable name for the Google Places API key.

### 6.2 Documentation
The environment variable MUST be documented in the project's environment variable pattern (consistent with existing `OPENAI_API_KEY`).
