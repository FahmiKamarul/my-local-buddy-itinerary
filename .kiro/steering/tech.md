# Tech Stack

## Core Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS (mobile-first) |
| AI SDK | Vercel AI SDK |
| Schema Validation | Zod |

## Key Libraries & Integrations

- **Vercel AI SDK** — AI integration with `maxSteps` for multi-round itinerary calculations, Tool Calling, and Structured Output (JSON)
- **Zod** — Schema definition for the `Card` type and structured AI output validation
- **Next.js App Router** — Unified frontend and backend (API routes via Route Handlers)
- **Tailwind CSS** — Mobile-first, vertical-scroll-optimized UI

## Project Structure Conventions

- App Router conventions: `app/` directory for pages and layouts, `app/api/` for route handlers
- Shared types and Zod schemas live in `lib/` or `types/`
- AI tool definitions (e.g. `calculate_itinerary`) live in `lib/tools/`
- Components in `components/`, organized by feature

## Common Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## AI SDK Notes

- Use `maxSteps` on `streamText` / `generateText` to allow the AI to loop through itinerary calculations until human-error buffers balance within the user's time window
- Tool Calling is used for the `calculate_itinerary` tool — handles Human Error Buffer math (Base Duration × 1.2–1.3) and priority-based card dropping
- Structured Output returns itinerary results as typed JSON matching the Zod schema

## Environment Variables

```bash
# Required
OPENAI_API_KEY=        # or whichever model provider is used
```
