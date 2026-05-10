import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { isRecognisedLocation } from "@/lib/locations";
import { CardDeckSchema } from "@/lib/schemas";

/**
 * Determines how many cards to generate based on trip duration.
 */
function getCardCount(tripDays: number): { total: number; questions: number; activities: number } {
  if (tripDays <= 1) return { total: 10, questions: 3, activities: 7 };
  if (tripDays <= 3) return { total: 13, questions: 4, activities: 9 };
  return { total: 15, questions: 5, activities: 10 };
}

/**
 * Schema for AI-generated card deck (used with generateObject).
 * Slightly relaxed compared to CardDeckSchema to give the AI room,
 * then we validate with the strict schema after.
 */
const AICardSchema = z.object({
  type: z.enum(["activity", "question"]),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(300),
  location: z.string().optional(),
  baseDuration: z.number().int().positive().max(720).optional(),
  price: z.string().optional(),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
  category: z.enum(["Food", "Culture", "Nature", "Shopping", "Entertainment", "Other"]).optional(),
});

const AIDeckSchema = z.object({
  cards: z.array(AICardSchema),
});

/**
 * Builds the system prompt for card generation.
 */
function buildDeckPrompt(destination: string, tripDays: number, counts: { questions: number; activities: number }): string {
  return `You are MY Buddy, a hyperlocal Malaysian trip planner. You speak in Malaysian-English (Manglish) — use slang like "Lepak", "Ngam", "On-the-way", "Makan", "Santai", "Shiok", "Boleh", "lah", "lor", "leh" naturally in descriptions.

Generate a card deck for a ${tripDays}-day trip to ${destination}, Malaysia.

Requirements:
- Generate exactly ${counts.questions} Clarifying Question Cards (type: "question")
- Generate exactly ${counts.activities} Activity Cards (type: "activity")
- Each card description MUST contain at least one Malaysian slang term
- Include culturally specific references (peak lunch traffic 12-2pm, hawker hours 7am-10pm, weekend crowds)

For QUESTION cards:
- Ask about travel preferences (food types, pace, budget, interests)
- Keep titles as questions (e.g. "Do you like street food?")
- Description should explain why this matters for the trip in Manglish tone

For ACTIVITY cards, include ALL these fields:
- title: Name of the attraction/activity
- description: Fun Manglish description with slang
- location: Specific location within ${destination}
- baseDuration: Realistic time in minutes (include travel/parking buffer awareness)
- price: Use "Free" or "RMX" or "RMX-RMY" format
- priority: "High" for must-visit, "Medium" for recommended, "Low" for nice-to-have
- category: One of "Food", "Culture", "Nature", "Shopping", "Entertainment", "Other"

Mix of priorities: ~30% High, ~40% Medium, ~30% Low
Mix of categories: include at least 2 Food spots, 1 Culture, and variety for the rest.
Activities should be REAL places in ${destination} with accurate pricing and durations.`;
}

/**
 * Fallback mock deck when no API key is available.
 */
function generateMockDeck(destination: string, tripDays: number) {
  const uuid = () => crypto.randomUUID();
  const counts = getCardCount(tripDays);

  const questionCards = [
    { id: uuid(), type: "question" as const, title: "Do you like street food?", description: "Makan at hawker stalls is the best lah! Cheap and shiok." },
    { id: uuid(), type: "question" as const, title: "Are you into history?", description: "Lepak at old heritage buildings and learn about the past lor." },
    { id: uuid(), type: "question" as const, title: "Do you enjoy nature walks?", description: "Santai walks through parks and gardens — ngam for relaxing." },
    { id: uuid(), type: "question" as const, title: "Want to try local desserts?", description: "Cendol, ais kacang, kuih — all the sweet makan spots boleh include!" },
    { id: uuid(), type: "question" as const, title: "Are you a morning person?", description: "Lepak early can avoid the crowd lah — shiok to have places to yourself." },
  ];

  const activityCards = [
    { id: uuid(), type: "activity" as const, title: "Jonker Street Night Market", description: "Makan your way through this famous night market — shiok giler!", location: "Jonker Street, Melaka", baseDuration: 90, price: "RM10-RM30", priority: "High" as const, category: "Food" as const },
    { id: uuid(), type: "activity" as const, title: "A Famosa Fort", description: "Lepak at this iconic Portuguese fort — on-the-way to other spots.", location: "Jalan Kota, Melaka", baseDuration: 30, price: "Free", priority: "Medium" as const, category: "Culture" as const },
    { id: uuid(), type: "activity" as const, title: "Melaka River Cruise", description: "Santai boat ride along the river — boleh see street art and old buildings.", location: "Melaka River", baseDuration: 45, price: "RM30", priority: "High" as const, category: "Nature" as const },
    { id: uuid(), type: "activity" as const, title: "Chicken Rice Ball", description: "Makan the famous Melaka chicken rice balls — ngam for lunch!", location: "Jonker Street", baseDuration: 45, price: "RM8-RM15", priority: "Medium" as const, category: "Food" as const },
    { id: uuid(), type: "activity" as const, title: "The Shore Sky Tower", description: "Shiok views from the top — boleh see the whole city from up there.", location: "The Shore, Melaka", baseDuration: 30, price: "RM25", priority: "Low" as const, category: "Entertainment" as const },
    { id: uuid(), type: "activity" as const, title: "Baba & Nyonya Museum", description: "Lepak and learn about Peranakan culture — very ngam for history lovers.", location: "Heeren Street, Melaka", baseDuration: 60, price: "RM16", priority: "Medium" as const, category: "Culture" as const },
    { id: uuid(), type: "activity" as const, title: "Stadthuys & Red Square", description: "On-the-way landmark — lepak for photos at the iconic red building.", location: "Dutch Square, Melaka", baseDuration: 20, price: "Free", priority: "Low" as const, category: "Culture" as const },
    { id: uuid(), type: "activity" as const, title: "Melaka Sultanate Palace", description: "Santai museum visit — boleh learn about the old Melaka kingdom.", location: "Jalan Kota, Melaka", baseDuration: 45, price: "RM5", priority: "Low" as const, category: "Culture" as const },
    { id: uuid(), type: "activity" as const, title: "Portuguese Settlement", description: "Makan fresh seafood by the sea — shiok dinner spot for sure!", location: "Portuguese Settlement, Melaka", baseDuration: 75, price: "RM20-RM50", priority: "Medium" as const, category: "Food" as const },
    { id: uuid(), type: "activity" as const, title: "Klebang Coconut Shake", description: "Lepak with the famous coconut shake — on-the-way if you're heading north.", location: "Klebang, Melaka", baseDuration: 20, price: "RM5", priority: "Low" as const, category: "Food" as const },
  ];

  const cards = [
    ...questionCards.slice(0, counts.questions),
    ...activityCards.slice(0, counts.activities),
  ];

  return { destination, cards };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { destination, tripDays = 1 } = body;

    if (!destination || !isRecognisedLocation(destination)) {
      return NextResponse.json(
        { error: "Alamak, we don't recognise that place lah! Try 'Melaka', 'Penang', or 'KL' — we're expanding soon, boleh?" },
        { status: 400 }
      );
    }

    const counts = getCardCount(tripDays);
    const hasApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key_here";

    let deck: { destination: string; cards: unknown[] };

    if (hasApiKey) {
      // --- AI-powered card generation ---
      const prompt = buildDeckPrompt(destination, tripDays, counts);

      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: AIDeckSchema,
        prompt,
        maxRetries: 3,
      });

      // Add UUIDs to each card (AI doesn't generate them)
      const cardsWithIds = object.cards.map((card) => ({
        ...card,
        id: crypto.randomUUID(),
      }));

      deck = { destination, cards: cardsWithIds };
    } else {
      // --- Fallback to mock data ---
      deck = generateMockDeck(destination, tripDays);
    }

    // Validate against strict schema
    const parsed = CardDeckSchema.safeParse(deck);
    if (!parsed.success) {
      console.error("Deck validation failed:", parsed.error.issues);

      // If AI output failed validation, fall back to mock
      if (hasApiKey) {
        console.warn("AI deck failed validation, falling back to mock deck");
        const mockDeck = generateMockDeck(destination, tripDays);
        const mockParsed = CardDeckSchema.safeParse(mockDeck);
        if (mockParsed.success) {
          return NextResponse.json({ deck: mockParsed.data });
        }
      }

      return NextResponse.json(
        { error: "Aiyoh, something went wrong generating your cards. Jom try again?" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deck: parsed.data });
  } catch (err) {
    console.error("Generate deck error:", err);
    return NextResponse.json(
      { error: "Aiyoh, something went wrong lah. Jom try again?" },
      { status: 500 }
    );
  }
}
