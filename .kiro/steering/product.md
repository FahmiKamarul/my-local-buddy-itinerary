

# Project Goal: MY Buddy – Hyperlocal Malaysian AI Itinerary Planner

## 1. Project Overview

**MY Buddy** is a mobile-responsive web application designed for the "Vibe Coding Use Case Challenge." It helps users plan day trips in Malaysia (starting with Melaka) using a **Smart Card** interface. The AI acts as a "Local Buddy" that creates realistic itineraries by accounting for traffic, Malaysian "waiting culture," and user priorities.

## 2. Core Technical Stack

* **Framework:** Next.js (App Router)
* **Language:** TypeScript (Unified Frontend & Backend)
* **AI Integration:** Vercel AI SDK
* **Styling:** Tailwind CSS (Mobile-First Design)
* **AI Features:** Multi-round prompting, Tool Calling (for card data), and Structured Output (JSON).

## 3. Key Features & Logic

### A. The "Smart Card" System

Each attraction or activity is represented as a card.

* **Properties:** Title, Location, Base Duration, Price, and **Priority** (High/Medium/Low).
* **Human Error Buffer:** All activities must include a mandatory time buffer (Base Duration + 20-30%) to account for parking, queues, or general "Malaysian timing" delays.

### B. Intelligent Itinerary Engine

* **Input:** Arrival time, Departure time, and a selection of activity cards.
* **Constraints:** AI must respect the time window. If the total duration (including buffers) exceeds the window, the AI must automatically drop **Low-Priority** cards.
* **Output:** Three ranked route options:
1. **Optimized:** Shortest travel distance.
2. **Makan-Focused:** Prioritizes food stops at peak times.
3. **Santai (Relaxed):** Maximized buffers for a stress-free pace.



### C. Hyperlocal Vibe

* **Tone:** Friendly, distinctly Malaysian (using local slang like "Lepak," "Ngam," "On-the-way").
* **UI:** Clean, card-based interface optimized for vertical mobile scrolling.

## 4. Development Milestones

1. **Phase 1:** Setup Next.js with Vercel AI SDK and define the `Card` Zod schema.
2. **Phase 2:** Implement the `calculate_itinerary` tool that handles the "Human Error" math and priority logic.
3. **Phase 3:** Create the mobile-first UI with a side-by-side view of selected cards and the AI-generated timeline.
4. **Phase 4:** Refine the AI prompt to ensure it suggests 3 distinct route variations.

## 5. Success Criteria

* The AI successfully drops a Low-priority card to save a High-priority one when time is tight.
* The itinerary feels realistic (e.g., it doesn't suggest driving across Melaka city in 5 minutes during lunch hour).
* The app works seamlessly on both iOS and Android browsers.

---

### Pro-Tip for your Agent:

When you hand this to your coding agent, tell it: *"Focus on the `maxSteps` feature of the Vercel AI SDK to allow the AI to loop through the itinerary calculations until the human-error buffers are perfectly balanced within the user's time frame."*