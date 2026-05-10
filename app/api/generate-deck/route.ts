import { NextResponse } from "next/server";
import { generateText, generateObject, stepCountIs } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { isRecognisedLocation } from "@/lib/locations";
import { CardDeckSchema } from "@/lib/schemas";
import { searchGooglePlacesTool } from "@/lib/tools/search-google-places";

/**
 * Location coordinates for biasing Google Places searches.
 */
const LOCATION_COORDS: Record<string, { latitude: number; longitude: number }> = {
  melaka: { latitude: 2.1896, longitude: 102.2501 },
  malacca: { latitude: 2.1896, longitude: 102.2501 },
  "kuala lumpur": { latitude: 3.1390, longitude: 101.6869 },
  kl: { latitude: 3.1390, longitude: 101.6869 },
  penang: { latitude: 5.4164, longitude: 100.3327 },
  "george town": { latitude: 5.4164, longitude: 100.3327 },
  "johor bahru": { latitude: 1.4927, longitude: 103.7414 },
  jb: { latitude: 1.4927, longitude: 103.7414 },
  ipoh: { latitude: 4.5975, longitude: 101.0901 },
  "kota kinabalu": { latitude: 5.9804, longitude: 116.0735 },
  kuching: { latitude: 1.5535, longitude: 110.3593 },
  "shah alam": { latitude: 3.0733, longitude: 101.5185 },
  "petaling jaya": { latitude: 3.1073, longitude: 101.6067 },
  "subang jaya": { latitude: 3.0565, longitude: 101.5851 },
};

/**
 * Normalizes AI-generated price strings to match our schema regex.
 * Handles formats like "RM 10 - RM 30", "RM10 to RM30", "RM10–RM30",
 * "RM10-20", "~RM15", "RM10 per person", "Varies", etc.
 */
function normalizePrice(price: string): string {
  const trimmed = price.trim();

  // Already "Free" or empty
  if (!trimmed || /^free$/i.test(trimmed)) return "Free";

  // Try to extract a range: "RM10 - RM30", "RM10-30", "RM 10 to RM 30"
  const rangeMatch = trimmed.match(/RM\s?(\d+(?:\.\d+)?)\s*[-–~to]+\s*(?:RM\s?)?(\d+(?:\.\d+)?)/i);
  if (rangeMatch) return `RM${rangeMatch[1]}-RM${rangeMatch[2]}`;

  // Single price: "RM 10", "RM10", "~RM15", "RM10 per person", "from RM5"
  const singleMatch = trimmed.match(/RM\s?(\d+(?:\.\d+)?)/i);
  if (singleMatch) return `RM${singleMatch[1]}`;

  // Just a number (AI sometimes returns "10" or "5-15")
  const bareRange = trimmed.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (bareRange) return `RM${bareRange[1]}-RM${bareRange[2]}`;

  const bareNumber = trimmed.match(/^(\d+(?:\.\d+)?)$/);
  if (bareNumber) return `RM${bareNumber[1]}`;

  // Fallback: can't parse, default to Free
  return "Free";
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
 * Schema for AI-generated card deck (relaxed — we normalize after).
 */
const AICardSchema = z.object({
  title: z.string(),
  description: z.string(),
  location: z.string().optional(),
  baseDuration: z.number().optional(),
  price: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  rating: z.number().optional(),
  openNow: z.boolean().optional(),
  reviewCount: z.number().optional(),
  photoUrl: z.string().optional(),
});

const AIDeckSchema = z.object({
  cards: z.array(AICardSchema),
});

/**
 * Builds the system prompt for tool-calling card generation.
 */
function buildToolCallingPrompt(
  destination: string,
  tripDays: number,
  counts: { questions: number; activities: number },
  preferences?: { question: string; answer: string }[]
): string {
  const preferencesContext = preferences && preferences.length > 0
    ? `\n\nUser Preferences:
${preferences.map((p) => `- ${p.question}: ${p.answer}`).join("\n")}

Tailor your searches based on these:
${preferences.some((p) => p.question.includes("family") && p.answer === "Yes")
  ? "- FAMILY trip — search for kid-friendly activities, family restaurants"
  : "- NOT a family trip — can include nightlife, adventurous spots"}
${preferences.some((p) => p.question.includes("food") && p.answer === "Yes")
  ? "- User LOVES food — search for more food spots (hawker stalls, famous restaurants)"
  : "- Not food-focused — 1-2 food spots max"}
${preferences.some((p) => p.question.includes("adventure") && p.answer === "Yes")
  ? "- User likes ADVENTURE — search for outdoor activities, nature spots"
  : ""}
${preferences.some((p) => p.question.includes("history") && p.answer === "Yes")
  ? "- User enjoys HISTORY — search for museums, heritage sites"
  : ""}
${preferences.some((p) => p.question.includes("budget") && p.answer === "Yes")
  ? "- User is on a BUDGET — search for free/cheap attractions"
  : ""}
${preferences.some((p) => p.question.includes("nightlife") && p.answer === "Yes")
  ? "- User wants NIGHTLIFE — search for bars, night markets"
  : ""}`
    : "";

  return `You are MY Buddy, a hyperlocal Malaysian trip planner. You speak in Malaysian-English (Manglish).

Generate ${counts.activities} activity cards for a ${tripDays}-day trip to ${destination}, Malaysia.${preferencesContext}

INSTRUCTIONS:
1. Use the search_google_places tool to find REAL places in ${destination}. Make only 2-3 searches max to keep it fast:
   - Search for "top attractions and food in ${destination}" (broad search, maxResults 10)
   - Search for "things to do in ${destination}" (maxResults 10)

2. After searching, compile the results into exactly ${counts.activities} activity cards. For each card, use the REAL data from Google Places:
   - Use the actual place name as the title
   - Write a SHORT Manglish description (1-2 sentences max) with slang (Lepak, Ngam, Makan, Santai, Shiok, Boleh, lah, lor)
   - Use the real address as the location
   - Include rating and review count

3. Return a JSON object with a "cards" array. Each card must have:
   - title: Real place name
   - description: SHORT Manglish description (max 80 chars) with local vibe
   - location: Real address from Google Places
   - baseDuration: Realistic time in minutes
   - price: "Free" or "RMX" or "RMX-RMY"
   - priority: "High" (must-visit, rating 4.5+), "Medium" (recommended, rating 4.0+), "Low" (nice-to-have)
   - category: "Food", "Culture", "Nature", "Shopping", "Entertainment", or "Other"
   - rating: The Google rating number (if available)
   - openNow: Whether it's currently open (if known)
   - reviewCount: Number of reviews (if available)
   - photoUrl: The photo URL from the search results (if available) — include this exactly as returned

Mix: ~30% High, ~40% Medium, ~30% Low priority. Include at least 2 Food spots and 1 Culture spot.`;
}

/**
 * Builds the fallback prompt for generateObject (no tool calling).
 */
function buildDeckPrompt(
  destination: string,
  tripDays: number,
  counts: { questions: number; activities: number },
  preferences?: { question: string; answer: string }[]
): string {
  const preferencesContext = preferences && preferences.length > 0
    ? `\n\nUser Preferences:
${preferences.map((p) => `- ${p.question}: ${p.answer}`).join("\n")}`
    : "";

  return `You are MY Buddy, a hyperlocal Malaysian trip planner. You speak in Malaysian-English (Manglish) — use slang like "Lepak", "Ngam", "On-the-way", "Makan", "Santai", "Shiok", "Boleh", "lah", "lor", "leh" naturally in descriptions.

Generate ${counts.activities} activity cards for a ${tripDays}-day trip to ${destination}, Malaysia.${preferencesContext}

For EACH activity card, include ALL these fields:
- title: Name of the attraction/activity
- description: Fun Manglish description with slang
- location: Specific location within ${destination}
- baseDuration: Realistic time in minutes
- price: Use "Free" or "RMX" or "RMX-RMY" format
- priority: "High" for must-visit, "Medium" for recommended, "Low" for nice-to-have
- category: One of "Food", "Culture", "Nature", "Shopping", "Entertainment", "Other"

Mix of priorities: ~30% High, ~40% Medium, ~30% Low.
Activities should be REAL places in ${destination} with accurate pricing and durations.`;
}

/**
 * Uses AI with tool calling (searchGooglePlaces) to generate enriched cards.
 */
async function generateDeckWithToolCalling(
  destination: string,
  tripDays: number,
  counts: { questions: number; activities: number },
  preferences?: { question: string; answer: string }[]
): Promise<z.infer<typeof AIDeckSchema> | null> {
  const prompt = buildToolCallingPrompt(destination, tripDays, counts, preferences);

  const hasGemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here";
  const hasDeepSeek = process.env.DEEP_SEEK_API_KEY && process.env.DEEP_SEEK_API_KEY !== "your_deepseek_api_key_here";

  let textResult: string | null = null;

  // Try Gemini first
  if (hasGemini) {
    try {
      const t0 = performance.now();
      console.log("[generate-deck] Starting Gemini tool-calling...");
      const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
      const result = await generateText({
        model: google("gemini-2.5-flash"),
        tools: { search_google_places: searchGooglePlacesTool },
        stopWhen: stepCountIs(12),
        prompt,
      });
      console.log(`[generate-deck] Gemini tool-calling completed in ${((performance.now() - t0) / 1000).toFixed(1)}s (${result.steps.length} steps)`);
      textResult = result.text;
    } catch (geminiErr: unknown) {
      const errMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      console.warn("Gemini tool-calling failed:", errMsg);
      if (!hasDeepSeek) throw geminiErr;
    }
  }

  // Fallback to DeepSeek
  if (!textResult && hasDeepSeek) {
    const t0 = performance.now();
    console.log("[generate-deck] Starting DeepSeek tool-calling...");
    const deepseek = createOpenAI({
      apiKey: process.env.DEEP_SEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
    const result = await generateText({
      model: deepseek.chat("deepseek-chat"),
      tools: { search_google_places: searchGooglePlacesTool },
      stopWhen: stepCountIs(4),
      prompt,
    });
    console.log(`[generate-deck] DeepSeek tool-calling completed in ${((performance.now() - t0) / 1000).toFixed(1)}s (${result.steps.length} steps)`);
    textResult = result.text;
  }

  if (!textResult) return null;

  // Parse the JSON from the AI's text response
  try {
    // Extract JSON from markdown code blocks or raw text
    const jsonMatch = textResult.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      textResult.match(/(\{[\s\S]*"cards"[\s\S]*\})/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      const validated = AIDeckSchema.safeParse(parsed);
      if (validated.success) return validated.data;
    }

    // Try parsing the entire text as JSON
    const directParse = JSON.parse(textResult);
    const validated = AIDeckSchema.safeParse(directParse);
    if (validated.success) return validated.data;
  } catch {
    console.warn("Failed to parse tool-calling response as JSON");
  }

  return null;
}

/**
 * Fallback: uses generateObject without tool calling.
 */
async function generateDeckWithStructuredOutput(
  destination: string,
  tripDays: number,
  counts: { questions: number; activities: number },
  preferences?: { question: string; answer: string }[]
): Promise<z.infer<typeof AIDeckSchema> | null> {
  const prompt = buildDeckPrompt(destination, tripDays, counts, preferences);

  const hasGemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here";
  const hasDeepSeek = process.env.DEEP_SEEK_API_KEY && process.env.DEEP_SEEK_API_KEY !== "your_deepseek_api_key_here";

  let object: z.infer<typeof AIDeckSchema> | null = null;

  // if (hasGemini) {
  //   try {
  //     const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
  //     const result = await generateObject({
  //       model: google("gemini-2.5-flash"),
  //       schema: AIDeckSchema,
  //       prompt,
  //       maxRetries: 2,
  //     });
  //     object = result.object;
  //   } catch (geminiErr: unknown) {
  //     const errMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
  //     console.warn("Gemini structured output failed:", errMsg);
  //     if (!hasDeepSeek) throw geminiErr;
  //   }
  // }

  if (!object && hasDeepSeek) {
    const t0 = performance.now();
    console.log("[generate-deck] Starting DeepSeek structured output...");
    const deepseek = createOpenAI({
      apiKey: process.env.DEEP_SEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
    const result = await generateText({
      model: deepseek.chat("deepseek-chat"),
      prompt: prompt + "\n\nRespond ONLY with a valid JSON object matching this structure: { \"cards\": [{ \"title\": string, \"description\": string, \"location\": string, \"baseDuration\": number, \"price\": string, \"priority\": string, \"category\": string }] }. No markdown, no explanation — just the JSON.",
    });
    console.log(`[generate-deck] DeepSeek structured output completed in ${((performance.now() - t0) / 1000).toFixed(1)}s`);

    // Parse JSON from DeepSeek's text response
    try {
      const text = result.text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
        text.match(/(\{[\s\S]*"cards"[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        const validated = AIDeckSchema.safeParse(parsed);
        if (validated.success) object = validated.data;
      } else {
        const directParse = JSON.parse(text);
        const validated = AIDeckSchema.safeParse(directParse);
        if (validated.success) object = validated.data;
      }
    } catch {
      console.warn("Failed to parse DeepSeek structured output response");
    }
  }

  return object;
}

/**
 * Fallback mock deck when no API key is available.
 */
function generateMockDeck(destination: string, tripDays: number) {
  const uuid = () => crypto.randomUUID();
  const counts = getCardCount(tripDays);

  const activityCards = [
    { id: uuid(), type: "activity" as const, title: "Jonker Street Night Market", description: "Makan your way through this famous night market — shiok giler! 4.4⭐ with 15k+ reviews, open Friday-Sunday nights.", location: "Jalan Hang Jebat, 75200 Melaka", baseDuration: 90, price: "RM10-RM30", priority: "High" as const, category: "Food" as const },
    { id: uuid(), type: "activity" as const, title: "A Famosa Fort", description: "Lepak at this iconic Portuguese fort — on-the-way to other spots. 4.3⭐, free entry lah!", location: "Jalan Kota, 75000 Melaka", baseDuration: 30, price: "Free", priority: "Medium" as const, category: "Culture" as const },
    { id: uuid(), type: "activity" as const, title: "Melaka River Cruise", description: "Santai boat ride along the river — boleh see street art and old buildings. 4.4⭐ with 8k reviews.", location: "Jalan Laksamana, Melaka", baseDuration: 45, price: "RM30", priority: "High" as const, category: "Nature" as const },
    { id: uuid(), type: "activity" as const, title: "Hoe Kee Chicken Rice Ball", description: "Makan the famous Melaka chicken rice balls — ngam for lunch! 4.2⭐, always got queue one.", location: "468 Jalan Hang Jebat, Melaka", baseDuration: 45, price: "RM8-RM15", priority: "Medium" as const, category: "Food" as const },
    { id: uuid(), type: "activity" as const, title: "The Shore Sky Tower", description: "Shiok views from the top — boleh see the whole city from up there. 4.1⭐ with 3k reviews.", location: "The Shore, Jalan Persisiran Bunga Raya, Melaka", baseDuration: 30, price: "RM25", priority: "Low" as const, category: "Entertainment" as const },
    { id: uuid(), type: "activity" as const, title: "Baba & Nyonya Heritage Museum", description: "Lepak and learn about Peranakan culture — very ngam for history lovers. 4.4⭐, well-preserved heritage house.", location: "48 & 50 Jalan Tun Tan Cheng Lock, Melaka", baseDuration: 60, price: "RM16", priority: "Medium" as const, category: "Culture" as const },
    { id: uuid(), type: "activity" as const, title: "Stadthuys & Red Square", description: "On-the-way landmark — lepak for photos at the iconic red building. 4.4⭐, free to see from outside.", location: "Dutch Square, Jalan Gereja, Melaka", baseDuration: 20, price: "Free", priority: "Low" as const, category: "Culture" as const },
    { id: uuid(), type: "activity" as const, title: "Melaka Sultanate Palace Museum", description: "Santai museum visit — boleh learn about the old Melaka kingdom. 4.1⭐, cheap entry.", location: "Jalan Kota, 75000 Melaka", baseDuration: 45, price: "RM5", priority: "Low" as const, category: "Culture" as const },
    { id: uuid(), type: "activity" as const, title: "Portuguese Settlement", description: "Makan fresh seafood by the sea — shiok dinner spot for sure! 3.9⭐ but the food is ngam.", location: "Portuguese Settlement, Ujong Pasir, Melaka", baseDuration: 75, price: "RM20-RM50", priority: "Medium" as const, category: "Food" as const },
    { id: uuid(), type: "activity" as const, title: "Klebang Original Coconut Shake", description: "Lepak with the famous coconut shake — on-the-way if you're heading north. 4.3⭐ with 10k reviews!", location: "Klebang Besar, Melaka", baseDuration: 20, price: "RM5", priority: "Low" as const, category: "Food" as const },
    { id: uuid(), type: "activity" as const, title: "Taming Sari Tower", description: "Santai revolving tower ride — boleh see Melaka from 80m up, shiok! 4.2⭐.", location: "Jalan Merdeka, Bandar Hilir, Melaka", baseDuration: 20, price: "RM23", priority: "Low" as const, category: "Entertainment" as const },
    { id: uuid(), type: "activity" as const, title: "Kampung Kling Mosque", description: "Lepak at this beautiful old mosque — on-the-way if you're in Harmony Street. 4.5⭐, free entry.", location: "Harmony Street, Jalan Tukang Emas, Melaka", baseDuration: 20, price: "Free", priority: "Low" as const, category: "Culture" as const },
  ];

  const cards = activityCards.slice(0, counts.activities);
  return { destination, cards };
}

export async function POST(request: Request) {
  const startTime = performance.now();
  try {
    const body = await request.json();
    const { destination, tripDays = 1, preferences } = body;

    if (!destination || !isRecognisedLocation(destination)) {
      return NextResponse.json(
        { error: "Alamak, destination cannot be empty lah! Type any place in Malaysia — boleh?" },
        { status: 400 }
      );
    }

    const counts = getCardCount(tripDays);
    const hasGooglePlaces = !!process.env.GOOGLE_PLACES_API_KEY;
    const hasAiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here") ||
      (process.env.DEEP_SEEK_API_KEY && process.env.DEEP_SEEK_API_KEY !== "your_deepseek_api_key_here");

    let deck: { destination: string; cards: unknown[] };

    if (hasAiKey) {
      let aiCards: z.infer<typeof AIDeckSchema> | null = null;

      // Strategy 1: Use tool calling with Google Places for real data
      if (hasGooglePlaces) {
        try {
          aiCards = await generateDeckWithToolCalling(destination, tripDays, counts, preferences);
        } catch (err) {
          console.warn("Tool-calling deck generation failed:", err);
        }
      }

      // Strategy 2: Fall back to structured output (no real place data)
      if (!aiCards) {
        try {
          aiCards = await generateDeckWithStructuredOutput(destination, tripDays, counts, preferences);
        } catch (err) {
          console.warn("Structured output deck generation failed:", err);
        }
      }

      if (aiCards) {
        const VALID_PRIORITIES = ["High", "Medium", "Low"];
        const VALID_CATEGORIES = ["Food", "Culture", "Nature", "Shopping", "Entertainment", "Other"];

        const cardsWithIds = aiCards.cards.map((card) => {
          // Build description — keep it short
          let description = (card.description ?? "").slice(0, 150) || "Shiok spot to check out lah!";

          // Add opening status if known and not already mentioned
          if (card.openNow !== undefined && !description.toLowerCase().includes("open")) {
            const status = card.openNow ? "Open now ✓" : "Closed now";
            description = `${description} — ${status}`.slice(0, 150);
          }

          return {
            id: crypto.randomUUID(),
            type: "activity" as const,
            title: (card.title ?? "").slice(0, 100) || "Untitled Activity",
            description,
            location: (card.location || destination).slice(0, 100),
            baseDuration: Math.max(1, Math.min(720, Math.round(card.baseDuration ?? 60))),
            price: normalizePrice(card.price || "Free"),
            priority: VALID_PRIORITIES.includes(card.priority ?? "") ? card.priority as "High" | "Medium" | "Low" : "Medium",
            category: VALID_CATEGORIES.includes(card.category ?? "") ? card.category as "Food" | "Culture" | "Nature" | "Shopping" | "Entertainment" | "Other" : "Other",
            ...(card.photoUrl ? { imageUrl: card.photoUrl } : {}),
            ...(card.rating ? { rating: card.rating } : {}),
            ...(card.reviewCount ? { reviewCount: card.reviewCount } : {}),
          };
        });
        deck = { destination, cards: cardsWithIds };
      } else {
        deck = generateMockDeck(destination, tripDays);
      }
    } else {
      deck = generateMockDeck(destination, tripDays);
    }

    // Validate against strict schema
    const parsed = CardDeckSchema.safeParse(deck);
    if (!parsed.success) {
      console.error("Deck validation failed:", parsed.error.issues);

      // Fall back to mock if AI output failed validation
      if (hasAiKey) {
        console.warn("AI deck failed validation, falling back to mock deck");
        const mockDeck = generateMockDeck(destination, tripDays);
        const mockParsed = CardDeckSchema.safeParse(mockDeck);
        if (mockParsed.success) {
          console.log(`[generate-deck] ✓ Total: ${((performance.now() - startTime) / 1000).toFixed(1)}s (fallback to mock)`);
          return NextResponse.json({ deck: mockParsed.data });
        }
      }

      return NextResponse.json(
        { error: "Aiyoh, something went wrong generating your cards. Jom try again?" },
        { status: 500 }
      );
    }

    console.log(`[generate-deck] ✓ Total request time: ${((performance.now() - startTime) / 1000).toFixed(1)}s — ${(deck.cards as unknown[]).length} cards for "${destination}"`);
    return NextResponse.json({ deck: parsed.data });
  } catch (err) {
    console.error("Generate deck error:", err);
    console.log(`[generate-deck] Total request time: ${((performance.now() - startTime) / 1000).toFixed(1)}s (error)`);
    return NextResponse.json(
      { error: "Aiyoh, something went wrong lah. Jom try again?" },
      { status: 500 }
    );
  }
}
