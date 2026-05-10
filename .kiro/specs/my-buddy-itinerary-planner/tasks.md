# Implementation Plan: MY Buddy Itinerary Planner

## Overview

Implement the MY Buddy mobile-first AI itinerary planner using Next.js (App Router), TypeScript, Tailwind CSS, Vercel AI SDK, and Zod. The implementation follows a bottom-up approach: shared schemas and utilities first, then the itinerary engine, then API route handlers, then UI components, and finally wiring everything together into a cohesive app.

---

## Tasks

- [x] 1. Project setup and shared foundations
  - [x] 1.1 Initialise Next.js project with TypeScript, Tailwind CSS, and install dependencies
    - Run `npx create-next-app@latest` with App Router, TypeScript, and Tailwind CSS options
    - Install `ai`, `@ai-sdk/openai`, `zod`, `framer-motion`, `fast-check` (dev dependency)
    - Add `OPENAI_API_KEY` placeholder to `.env.local` and `.env.example`
    - Configure `tailwind.config.ts` with mobile-first breakpoints (320px base)
    - _Requirements: 8.1_

  - [x] 1.2 Define all Zod schemas in `lib/schemas.ts`
    - Implement `CardSchema`, `ActivityCardSchema`, `CardDeckSchema`
    - Implement `ScheduledActivitySchema`, `RouteItinerarySchema`, `ItineraryResultSchema`
    - Export all inferred TypeScript types (`Card`, `ActivityCard`, `CardDeck`, `ScheduledActivity`, `RouteItinerary`, `ItineraryResult`)
    - _Requirements: 9.1, 9.2, 2.3, 4.6_

  - [x] 1.3 Write property test for Zod schema round-trip (Property 16)
    - **Property 16: Zod Schema Round-Trip for Cards and Itineraries**
    - **Validates: Requirements 9.1, 9.2**
    - Use `fast-check` arbitraries to generate structurally valid and invalid objects; assert parse succeeds / throws `ZodError` accordingly
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 16: Zod schema round-trip`

  - [x] 1.4 Implement `lib/locations.ts` with `RECOGNISED_LOCATIONS` list and `isRecognisedLocation` helper
    - Include Melaka, Penang, KL, JB, Ipoh, Kota Kinabalu, Kuching, Shah Alam, Petaling Jaya, Subang Jaya and common aliases
    - Implement case-insensitive, trimmed matching
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 1.5 Write property test for destination validation (Property 1)
    - **Property 1: Destination Validation is Exhaustive**
    - **Validates: Requirements 1.2, 1.3, 1.4**
    - Generate arbitrary strings; assert `isRecognisedLocation` accepts only recognised entries with 1–100 non-whitespace chars
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 1: destination validation exhaustive`

  - [x] 1.6 Implement `lib/time-utils.ts` with `validateTimeWindow` and time arithmetic helpers
    - `validateTimeWindow(arrival, departure)` — returns error if gap < 30 minutes or arrival ≥ departure
    - `parseHHMM(time: string): number` — converts HH:MM to minutes since midnight
    - `formatHHMM(minutes: number): string` — converts minutes back to HH:MM
    - `addMinutes(time: string, minutes: number): string`
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 1.7 Write property test for time window validation (Property 13)
    - **Property 13: Time Window Validation**
    - **Validates: Requirements 6.3, 6.4**
    - Generate arbitrary HH:MM pairs; assert `validateTimeWindow` rejects when gap < 30 min or arrival ≥ departure
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 13: time window validation`

- [x] 2. Itinerary engine — core calculation logic
  - [x] 2.1 Implement `calculateBufferedDuration` in `lib/itinerary-engine.ts`
    - `calculateBufferedDuration(baseDuration: number, multiplier: number): number`
    - Formula: `Math.ceil((baseDuration * multiplier) / 5) * 5`
    - Export as a named function; no side effects
    - _Requirements: 4.2, 5.4_

  - [x] 2.2 Write property test for Human Error Buffer calculation (Property 7)
    - **Property 7: Human Error Buffer Calculation**
    - **Validates: Requirements 4.2, 5.4**
    - Generate `baseDuration` in [1, 720] and multiplier in {1.25, 1.30}; assert result equals `Math.ceil((baseDuration * multiplier) / 5) * 5`
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 7: human error buffer calculation`

  - [x] 2.3 Implement `dropCardsToFitWindow` in `lib/itinerary-engine.ts`
    - Accept `cards: ActivityCard[]` and `availableMinutes: number`
    - Drop Low-priority cards first, then Medium, never High; within tier drop longest `bufferedDuration` first
    - Return `{ keptCards, droppedCards, warning? }`
    - Handle the edge case where High-priority cards alone exceed the window (return partial + warning)
    - _Requirements: 4.4, 4.5, 4.8, 4.9, 5.5_

  - [x] 2.4 Write property test for priority-based card dropping (Property 8)
    - **Property 8: Priority-Based Card Dropping Invariant**
    - **Validates: Requirements 4.4, 4.5, 5.5**
    - Generate arbitrary `ActivityCard[]` sets and time windows; assert (a) no High card dropped, (b) all Low before any Medium, (c) longest-first within tier, (d) result fits window or is High-only
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 8: priority-based card dropping invariant`

  - [x] 2.5 Implement `assignStartEndTimes` in `lib/itinerary-engine.ts`
    - Walk ordered activity list assigning `startTime` and `endTime` per the design's Step 5 algorithm
    - Accept optional `restIntervalMinutes` (0 for non-Santai, 15 for Santai)
    - _Requirements: 4.2, 5.4, 6.5_

  - [x] 2.6 Write property test for time window boundary preservation (Property 14)
    - **Property 14: Time Window Boundary Preservation**
    - **Validates: Requirements 6.5**
    - Generate valid `(arrivalTime, departureTime)` pairs; assert the first activity's `startTime` equals `arrivalTime` exactly (no rounding or timezone shift)
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 14: time window boundary preservation`

  - [x] 2.7 Implement route-ordering strategies in `lib/itinerary-engine.ts`
    - `orderOptimized(cards, destination)` — nearest-neighbour heuristic on geographic zones; tie-break by priority
    - `orderMakanFocused(cards, arrivalTime, departureTime)` — slot Food cards into meal windows; fill gaps with highest-priority non-food cards
    - `orderSantai(cards, availableMinutes)` — apply 1.30× buffer, insert 15-min rest intervals, drop lowest-priority if needed
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [x] 2.8 Write property test for Santai rest interval invariant (Property 12)
    - **Property 12: Santai Route Rest Interval Invariant**
    - **Validates: Requirements 5.4**
    - Generate Santai route outputs with ≥ 2 activities; assert gap between consecutive `endTime`/`startTime` is exactly 15 min and each `bufferedDuration` equals `Math.ceil((baseDuration * 1.30) / 5) * 5`
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 12: santai rest interval invariant`

  - [x] 2.9 Write property test for Makan-Focused food scheduling (Property 11)
    - **Property 11: Makan-Focused Food Scheduling**
    - **Validates: Requirements 5.3**
    - Generate accepted card sets with at least one Food-category card; assert the Makan-Focused route schedules it within a valid meal window (07:00–09:00, 12:00–14:00, or 18:00–21:00)
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 11: makan-focused food scheduling`

- [ ] 3. Checkpoint — core engine tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. `calculate_itinerary` Vercel AI SDK Tool
  - [x] 4.1 Implement `calculateItineraryTool` in `lib/tools/calculate-itinerary.ts`
    - Define tool using `tool()` from `ai` with Zod parameter schema (cards, arrivalTime, departureTime, bufferMultiplier, routeType)
    - `execute` function: call `calculateBufferedDuration`, `dropCardsToFitWindow`, route-ordering strategy, `assignStartEndTimes`
    - Return a `RouteItinerary` object
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1_

  - [ ] 4.2 Write property test for itinerary output schema validity (Property 9)
    - **Property 9: Itinerary Output Schema Validity**
    - **Validates: Requirements 4.6, 9.2**
    - Generate valid tool inputs; assert the returned `ItineraryResult` parses through `ItineraryResultSchema` without error and the parsed object deeply equals the pre-parse value
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 9: itinerary output schema validity`

  - [ ] 4.3 Write property test for three route variants always present (Property 10)
    - **Property 10: Three Route Variants Always Present**
    - **Validates: Requirements 5.1**
    - Generate valid accepted card sets and time windows (gap ≥ 30 min); assert `ItineraryResult.routes` contains exactly 3 entries with `route` values `'optimized'`, `'makan-focused'`, `'santai'`, each with ≥ 1 activity
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 10: three route variants always present`

- [ ] 5. API Route Handlers
  - [ ] 5.1 Implement `POST /api/generate-deck` route handler in `app/api/generate-deck/route.ts`
    - Validate `destination` against `RECOGNISED_LOCATIONS`; return 400 with Malaysian-English error if invalid
    - Call `generateObject({ model, schema: CardDeckSchema, prompt })` with Malaysian-English system prompt including slang requirements
    - Implement per-card retry logic (up to 3 replacement attempts for invalid cards)
    - Return `{ deck: CardDeck }` or `{ error: string }`
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.9, 7.1, 7.2, 7.3, 7.4, 7.5, 9.3, 9.4, 9.5, 9.6_

  - [x] 5.2 Implement `POST /api/generate-itinerary` route handler in `app/api/generate-itinerary/route.ts`
    - Validate request body: `acceptedCards`, `arrivalTime`, `departureTime`, `destination`
    - Validate time window using `validateTimeWindow`
    - Call `generateText({ model, tools: { calculate_itinerary: calculateItineraryTool }, maxSteps: 10, prompt })`
    - Parse final tool result through `ItineraryResultSchema`; implement 2-second-delay retry (up to 2 additional attempts) on Zod parse failure
    - Return `{ itinerary: ItineraryResult }` or `{ error: string }`
    - _Requirements: 4.1, 4.3, 4.6, 4.7, 4.8, 4.9, 9.3, 9.4, 9.5, 9.6_

- [x] 6. Card round-trip integrity utilities
  - [x] 6.1 Implement `validateCardRoundTrip` in `lib/card-utils.ts`
    - Serialise card via `JSON.stringify` then deserialise via `JSON.parse`
    - Compare `title`, `location`, `baseDuration`, `price`, `priority` with strict equality
    - Log failure with card `title` if check fails; return boolean
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 6.2 Write property test for card data round-trip integrity (Property 15)
    - **Property 15: Card Data Round-Trip Integrity**
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - Generate arbitrary valid `Card` objects; assert `JSON.parse(JSON.stringify(card))` produces strictly equal field values for all five fields
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 15: card data round-trip integrity`

- [ ] 7. Destination Input UI
  - [ ] 7.1 Implement `DestinationInput` component in `components/DestinationInput.tsx`
    - Controlled input with inline validation messages (Malaysian-English tone)
    - Validate on submit: empty/whitespace → retain field, show prompt; unrecognised → retain value, show Malaysian-English error
    - Minimum 44×44px touch target for submit button
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 8.2_

  - [ ] 7.2 Implement `app/page.tsx` — Destination Input Page
    - Render `DestinationInput` in a mobile-first, single-column layout (320px–428px)
    - On valid submission, call `POST /api/generate-deck` and transition to `/swipe` within 3 seconds
    - Show `LoadingIndicator` while deck is being generated
    - _Requirements: 1.1, 1.5, 2.8_

- [ ] 8. Swipe Session UI
  - [ ] 8.1 Implement `SwipeCard` component in `components/SwipeCard.tsx`
    - Use Framer Motion `motion.div` with `drag="x"` and `dragConstraints`
    - Show green overlay on rightward drag, red on leftward drag; remove overlay within 300ms of gesture end
    - Trigger `onSwipeRight` / `onSwipeLeft` callbacks when `|offset.x| > 100px`
    - Respond to gesture within 100ms using `useTransform` for zero-latency visual feedback
    - Minimum 44×44px touch targets for all interactive elements
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.8, 8.2_

  - [ ] 8.2 Implement `SwipeControls` component in `components/SwipeControls.tsx`
    - Left button calls `onSwipeLeft`, right button calls `onSwipeRight`
    - Minimum 44×44px touch targets
    - _Requirements: 3.5, 8.2_

  - [ ] 8.3 Implement `SwipeCardStack` component in `components/SwipeCardStack.tsx`
    - Manage `SwipeSessionState` (deck, currentIndex, acceptedCards, answers, status)
    - Render top 2 cards for depth effect; advance index on swipe
    - Record Clarifying Question Card answers (`Yes`/`No`) keyed by question text
    - On final card swipe, end session within 500ms and trigger itinerary generation
    - If < 2 accepted cards at session end, show encouraging message + restart button
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.9, 3.10_

  - [ ] 8.4 Write property test for swipe outcome correctness (Property 5)
    - **Property 5: Swipe Outcome Correctness**
    - **Validates: Requirements 3.2, 3.3, 3.5**
    - Generate arbitrary card decks and swipe sequences; assert right-swipe adds card to `acceptedCards` and advances index by 1; left-swipe excludes card and advances index by 1
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 5: swipe outcome correctness`

  - [ ] 8.5 Write property test for clarifying question answer recording (Property 6)
    - **Property 6: Clarifying Question Answer Recording**
    - **Validates: Requirements 3.6, 3.7**
    - Generate question cards and swipe directions; assert `answers[card.title]` is `'Yes'` on right-swipe and `'No'` on left-swipe, persisting unchanged for the rest of the session
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 6: clarifying question answer recording`

  - [ ] 8.6 Implement `app/swipe/page.tsx` — Swipe Session Page
    - Receive `CardDeck` from navigation state (or re-fetch if missing)
    - Render `SwipeCardStack` with `LoadingIndicator` while deck loads
    - On session complete with ≥ 2 accepted cards, navigate to `/itinerary` passing accepted cards and time window
    - _Requirements: 2.8, 3.1, 3.9, 3.10_

- [ ] 9. Time Window Input UI
  - [ ] 9.1 Implement `TimeWindowInput` component in `components/TimeWindowInput.tsx`
    - HH:MM (24-hour) arrival and departure pickers
    - Pre-populate with 09:00 / 18:00 on first render
    - Validate on change/submit: show error if gap < 30 min or arrival ≥ departure
    - Minimum 44×44px touch targets
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.2_

- [ ] 10. Checkpoint — engine, API, and swipe tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Itinerary Display UI
  - [ ] 11.1 Implement `ActivitySchedule` component in `components/ActivitySchedule.tsx`
    - Render time-ordered list of activities with start time, buffered duration, location, and price
    - Show `warningMessage` if cards were dropped
    - Mobile-first single-column layout; minimum 44×44px touch targets
    - _Requirements: 5.7, 4.8, 4.9, 8.1, 8.2_

  - [ ] 11.2 Implement `RouteTabBar` component in `components/RouteTabBar.tsx`
    - Three tabs: Optimized, Makan-Focused, Santai
    - Highlight selected tab; switching tabs updates displayed `ActivitySchedule`
    - Minimum 44×44px touch targets
    - _Requirements: 5.1, 5.6, 5.7_

  - [ ] 11.3 Implement `app/itinerary/page.tsx` — Itinerary Page
    - Call `POST /api/generate-itinerary` with accepted cards and time window on mount
    - Show `LoadingIndicator` while generating; display itinerary within 5 seconds of swipe session end
    - Render `RouteTabBar` + `ActivitySchedule` for the selected route
    - Show `ErrorMessage` with retry button on API failure
    - _Requirements: 4.7, 5.1, 5.6, 5.7, 8.1_

- [ ] 12. Shared UI components
  - [ ] 12.1 Implement `LoadingIndicator` component in `components/LoadingIndicator.tsx`
    - Rotate through Malaysian-English loading messages containing at least one slang term per message
    - _Requirements: 2.8, 7.1, 7.2_

  - [ ] 12.2 Implement `ErrorMessage` component in `components/ErrorMessage.tsx`
    - Reusable inline error with optional retry button
    - All copy in Malaysian-English tone
    - _Requirements: 1.3, 1.4, 2.6, 2.9, 3.10, 7.1_

- [ ] 13. Card Deck composition validation
  - [ ] 13.1 Write property test for Card Deck size and composition invariant (Property 2)
    - **Property 2: Card Deck Size and Composition Invariant**
    - **Validates: Requirements 2.1, 2.2**
    - Generate arbitrary `CardDeck` objects; assert deck size is 8–15, ≥ 3 question cards, ≥ 4 activity cards
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 2: card deck size and composition invariant`

  - [ ] 13.2 Write property test for Activity Card field completeness (Property 3)
    - **Property 3: Activity Card Field Completeness**
    - **Validates: Requirements 2.3, 9.1**
    - Generate arbitrary `ActivityCard` objects; assert all five required fields are present, non-null, and within their type/range constraints
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 3: activity card field completeness`

  - [ ] 13.3 Write property test for Malaysian slang presence (Property 4)
    - **Property 4: Malaysian Slang Presence in Card Descriptions**
    - **Validates: Requirements 2.7, 7.2**
    - For any card description string produced by the system, assert it contains at least one term from {"Lepak", "Ngam", "On-the-way", "Makan", "Santai", "Shiok", "Boleh"} (case-insensitive)
    - Tag: `// Feature: my-buddy-itinerary-planner, Property 4: malaysian slang presence`

- [ ] 14. Mobile layout and landscape reflow
  - [ ] 14.1 Add global CSS and Tailwind configuration for mobile-first layout
    - Ensure all screens render correctly at 320px–428px viewport widths
    - Add `overflow-x: hidden` on root with landscape reflow via CSS media query; allow horizontal scroll as fallback if reflow fails
    - Verify all interactive elements have `min-w-[44px] min-h-[44px]` Tailwind classes
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [ ] 15. Integration wiring and end-to-end flow
  - [ ] 15.1 Wire navigation flow: Destination → Swipe → Itinerary
    - Pass `CardDeck` from `/api/generate-deck` response into `SwipeSessionPage` via URL state or session storage
    - Pass `acceptedCards`, `arrivalTime`, `departureTime`, `destination` from swipe session into `ItineraryPage`
    - Ensure `validateCardRoundTrip` is called on each accepted card before passing to `POST /api/generate-itinerary`; log and exclude any card that fails
    - _Requirements: 1.5, 3.9, 4.1, 10.1, 10.2, 10.3, 10.4_

  - [ ] 15.2 Integrate `TimeWindowInput` into the Swipe Session or Itinerary page flow
    - Display arrival/departure time fields before itinerary generation is triggered
    - Block itinerary generation until valid times are entered
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 15.3 Write integration test for `POST /api/generate-deck`
    - Assert a valid destination returns a `CardDeck` matching `CardDeckSchema`
    - Mock AI to return invalid JSON on first call, valid on second; assert retry logic works
    - _Requirements: 2.1, 2.4, 2.5, 9.3, 9.4_

  - [ ] 15.4 Write integration test for `POST /api/generate-itinerary`
    - Assert valid accepted cards + time window returns `ItineraryResult` matching `ItineraryResultSchema`
    - Mock Zod parse failure on first attempt; assert 2-second-delay retry fires and succeeds on second attempt
    - _Requirements: 4.6, 9.3, 9.4, 9.5_

- [ ] 16. Final checkpoint — all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; all 16 correctness properties are covered by the `*` sub-tasks
- Each task references specific requirements for traceability
- Property-based tests use `fast-check` with a minimum of 100 iterations per property
- All user-facing copy (errors, loading messages, card descriptions) must use Malaysian-English tone with at least one slang term
- The `calculate_itinerary` tool is pure TypeScript — no external API calls — making it fully unit-testable
- `maxSteps: 10` on `generateText` allows the AI to iteratively refine the itinerary across multiple tool-call roundtrips
- Checkpoints at tasks 3, 10, and 16 ensure incremental validation throughout the build

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.6"] },
    { "id": 2, "tasks": ["1.3", "1.5", "1.7", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.5"] },
    { "id": 4, "tasks": ["2.4", "2.6", "2.7", "6.1"] },
    { "id": 5, "tasks": ["2.8", "2.9", "6.2", "4.1"] },
    { "id": 6, "tasks": ["4.2", "4.3", "5.1", "5.2"] },
    { "id": 7, "tasks": ["7.1", "9.1", "12.1", "12.2", "13.1", "13.2", "13.3"] },
    { "id": 8, "tasks": ["7.2", "8.1", "8.2"] },
    { "id": 9, "tasks": ["8.3", "8.6", "11.1", "11.2", "14.1"] },
    { "id": 10, "tasks": ["8.4", "8.5", "11.3"] },
    { "id": 11, "tasks": ["15.1", "15.2"] },
    { "id": 12, "tasks": ["15.3", "15.4"] }
  ]
}
```
