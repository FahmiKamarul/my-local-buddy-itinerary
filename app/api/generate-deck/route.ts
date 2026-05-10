import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { isRecognisedLocation } from "@/lib/locations";
import { CardDeckSchema } from "@/lib/schemas";

/**
 * Normalizes AI-generated price strings to match our schema regex.
 * Handles formats like "RM 10 - RM 30", "RM10 to RM30", "RM10–RM30", etc.
 */
function normalizePrice(price: string): string {
  const trimmed = price.trim();

  // Already "Free"
  if (/^free$/i.test(trimmed)) return "Free";

  // Try to extract numbers from RM patterns
  const rangeMatch = trimmed.match(/RM\s?(\d+(?:\.\d+)?)\s*[-–~to]+\s*(?:RM\s?)?(\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    return `RM${rangeMatch[1]}-RM${rangeMatch[2]}`;
  }

  // Single price: "RM 10", "RM10", "RM 10.50"
  const singleMatch = trimmed.match(/RM\s?(\d+(?:\.\d+)?)/i);
  if (singleMatch) {
    return `RM${singleMatch[1]}`;
  }

  // Fallback: return as-is and let validation catch it
  return trimmed;
}

/**
 * Determines how many cards to generate based on trip duration.
 */
function getCardCount(tripDays: number): { total: number; questions: number; activities: number } {
  if (tripDays <= 1) return { total: 8, questions: 0, activities: 8 };
  if (tripDays <= 3) return { total: 10, questions: 0, activities: 10 };
  return { total: 12, questions: 0, activities: 12 };
}

/**
 * Schema for AI-generated card deck (used with generateObject).
 * Only generates activity cards — questions are handled client-side.
 */
const AICardSchema = z.object({
  type: z.literal("activity"),
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
 * Builds the system prompt for card generation, incorporating user preferences.
 */
function buildDeckPrompt(
  destination: string,
  tripDays: number,
  counts: { questions: number; activities: number },
  preferences?: { question: string; answer: string }[]
): string {
  const preferencesContext = preferences && preferences.length > 0
    ? `\n\nUser Preferences (use these to personalise the cards):
${preferences.map((p) => `- ${p.question}: ${p.answer}`).join("\n")}

IMPORTANT: Tailor your activity suggestions based on these answers:
${preferences.some((p) => p.question.includes("family") && p.answer === "Yes")
  ? "- This is a FAMILY trip — include kid-friendly activities, avoid nightlife, suggest family restaurants"
  : "- This is NOT a family trip — can include nightlife, adventurous activities, adult-oriented spots"}
${preferences.some((p) => p.question.includes("food") && p.answer === "Yes")
  ? "- User LOVES food — include more Food category cards (at least 3-4), hawker stalls, famous restaurants"
  : "- User is not food-focused — include 1-2 food spots max, focus on other categories"}
${preferences.some((p) => p.question.includes("adventure") && p.answer === "Yes")
  ? "- User likes ADVENTURE — include Nature/outdoor activities, hiking, water sports if available"
  : ""}
${preferences.some((p) => p.question.includes("history") && p.answer === "Yes")
  ? "- User enjoys HISTORY — include museums, heritage sites, historical landmarks"
  : ""}
${preferences.some((p) => p.question.includes("budget") && p.answer === "Yes")
  ? "- User is on a BUDGET — prioritise free/cheap activities, street food over restaurants, free attractions"
  : "- Budget is flexible — can include premium experiences and restaurants"}
${preferences.some((p) => p.question.includes("nightlife") && p.answer === "Yes")
  ? "- User wants NIGHTLIFE — include bars, night markets, evening entertainment"
  : ""}`
    : "";

  return `You are MY Buddy, a hyperlocal Malaysian trip planner. You speak in Malaysian-English (Manglish) — use slang like "Lepak", "Ngam", "On-the-way", "Makan", "Santai", "Shiok", "Boleh", "lah", "lor", "leh" naturally in descriptions.

Generate ${counts.activities} activity cards for a ${tripDays}-day trip to ${destination}, Malaysia.${preferencesContext}

Requirements:
- Generate exactly ${counts.activities} Activity Cards (type: "activity")
- Each card description MUST contain at least one Malaysian slang term
- Include culturally specific references (peak lunch traffic 12-2pm, hawker hours 7am-10pm, weekend crowds)
- ALL cards must have type: "activity"

For EACH activity card, include ALL these fields:
- type: "activity" (always)
- title: Name of the attraction/activity
- description: Fun Manglish description with slang
- location: Specific location within ${destination}
- baseDuration: Realistic time in minutes (include travel/parking buffer awareness)
- price: Use "Free" or "RMX" or "RMX-RMY" format (e.g. "Free", "RM10", "RM5-RM15")
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
    { id: uuid(), type: "activity" as const, title: "Taming Sari Tower", description: "Santai revolving tower ride — boleh see Melaka from 80m up, shiok!", location: "Jalan Merdeka, Melaka", baseDuration: 20, price: "RM23", priority: "Low" as const, category: "Entertainment" as const },
    { id: uuid(), type: "activity" as const, title: "Kampung Kling Mosque", description: "Lepak at this beautiful old mosque — on-the-way if you're in Harmony Street.", location: "Harmony Street, Melaka", baseDuration: 20, price: "Free", priority: "Low" as const, category: "Culture" as const },
  ];

  const cards = activityCards.slice(0, counts.activities);

  return { destination, cards };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { destination, tripDays = 1, preferences } = body;

    if (!destination || !isRecognisedLocation(destination)) {
      return NextResponse.json(
        { error: "Alamak, we don't recognise that place lah! Try 'Melaka', 'Penang', or 'KL' — we're expanding soon, boleh?" },
        { status: 400 }
      );
    }

    const counts = getCardCount(tripDays);
    const hasApiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here";

    let deck: { destination: string; cards: unknown[] };

    if (hasApiKey) {
      // --- AI-powered card generation ---
      const prompt = buildDeckPrompt(destination, tripDays, counts, preferences);

      const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: AIDeckSchema,
        prompt,
        maxRetries: 3,
      });

      // Add UUIDs and normalize price format for each card
      const cardsWithIds = object.cards.map((card) => ({
        ...card,
        id: crypto.randomUUID(),
        // Normalize price: ensure it matches "Free" or "RMX" or "RMX-RMY" pattern
        price: card.price ? normalizePrice(card.price) : undefined,
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
