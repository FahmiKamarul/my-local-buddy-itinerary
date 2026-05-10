import { NextResponse } from "next/server";
import { generateText, stepCountIs } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { validateTimeWindow, parseHHMM } from "@/lib/time-utils";
import {
  calculateBufferedDuration,
  dropCardsToFitWindow,
  assignStartEndTimes,
  orderOptimized,
  orderMakanFocused,
  orderSantai,
} from "@/lib/itinerary-engine";
import { ItineraryResultSchema, type ActivityCard } from "@/lib/schemas";
import { calculateItineraryTool } from "@/lib/tools/calculate-itinerary";

/**
 * Generates itinerary using the local engine (no AI needed for calculation).
 * The engine handles buffer math, priority dropping, and route ordering deterministically.
 */
function generateLocalItinerary(
  activityCards: ActivityCard[],
  arrivalTime: string,
  departureTime: string,
  destination: string
) {
  const availableMinutes = parseHHMM(departureTime) - parseHHMM(arrivalTime);

  // --- Optimized Route ---
  const optimizedBuffered = activityCards.map((c) => ({
    ...c,
    bufferedDuration: calculateBufferedDuration(c.baseDuration, 1.25),
  }));
  const optimizedDrop = dropCardsToFitWindow(optimizedBuffered, availableMinutes);
  const optimizedOrdered = orderOptimized(optimizedDrop.keptCards, destination);
  const optimizedActivities = assignStartEndTimes(optimizedOrdered, arrivalTime, 0);
  const optimizedTotal = optimizedActivities.reduce((s, a) => s + a.bufferedDuration, 0);

  // --- Makan-Focused Route ---
  const makanBuffered = activityCards.map((c) => ({
    ...c,
    bufferedDuration: calculateBufferedDuration(c.baseDuration, 1.25),
  }));
  const makanDrop = dropCardsToFitWindow(makanBuffered, availableMinutes);
  const makanOrdered = orderMakanFocused(makanDrop.keptCards, arrivalTime, departureTime);
  const makanActivities = assignStartEndTimes(makanOrdered, arrivalTime, 0);
  const makanTotal = makanActivities.reduce((s, a) => s + a.bufferedDuration, 0);

  // --- Santai Route ---
  const santaiResult = orderSantai(activityCards, availableMinutes);
  const santaiActivities = assignStartEndTimes(santaiResult.orderedCards, arrivalTime, 15);
  const santaiTotal = santaiActivities.reduce((s, a) => s + a.bufferedDuration, 0);

  return {
    destination,
    arrivalTime,
    departureTime,
    routes: [
      {
        route: "optimized" as const,
        activities: optimizedActivities,
        totalDuration: Math.min(optimizedTotal, 1440),
        droppedCards: optimizedDrop.droppedCards.map((c) => c.title),
        warningMessage: optimizedDrop.warning,
      },
      {
        route: "makan-focused" as const,
        activities: makanActivities,
        totalDuration: Math.min(makanTotal, 1440),
        droppedCards: makanDrop.droppedCards.map((c) => c.title),
        warningMessage: makanDrop.warning,
      },
      {
        route: "santai" as const,
        activities: santaiActivities,
        totalDuration: Math.min(santaiTotal, 1440),
        droppedCards: santaiResult.droppedCards.map((c) => c.title),
        warningMessage: santaiResult.warning,
      },
    ],
  };
}

/**
 * Uses AI with tool calling to generate an itinerary.
 * The AI can iteratively call the calculate_itinerary tool to refine the schedule.
 */
async function generateAIItinerary(
  activityCards: ActivityCard[],
  arrivalTime: string,
  departureTime: string,
  destination: string,
  answers?: Record<string, string>
) {
  const answersContext = answers
    ? Object.entries(answers)
        .map(([q, a]) => `- ${q}: ${a}`)
        .join("\n")
    : "No preference questions answered.";

  const prompt = `You are MY Buddy, a Malaysian trip planner. Generate an itinerary for a trip to ${destination}.

Time window: ${arrivalTime} to ${departureTime}
User preferences from swipe session:
${answersContext}

Available activity cards (user accepted these):
${activityCards.map((c) => `- ${c.title} (${c.category}, ${c.priority} priority, ${c.baseDuration}min, ${c.price}, at ${c.location})`).join("\n")}

Please call the calculate_itinerary tool THREE times — once for each route type:
1. First call with routeType "optimized" and bufferMultiplier 1.25
2. Second call with routeType "makan-focused" and bufferMultiplier 1.25
3. Third call with routeType "santai" and bufferMultiplier 1.30

Use ALL the accepted activity cards for each call. The tool will handle dropping cards that don't fit.`;

  // Try Gemini first, fallback to DeepSeek on failure (e.g. 429)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let steps: any[] | null = null;

  const hasGemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here";
  const hasDeepSeek = process.env.DEEP_SEEK_API_KEY && process.env.DEEP_SEEK_API_KEY !== "your_deepseek_api_key_here";

  if (hasGemini) {
    try {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
      const result = await generateText({
        model: google("gemini-2.0-flash"),
        tools: { calculate_itinerary: calculateItineraryTool },
        stopWhen: stepCountIs(10),
        prompt,
      });
      steps = result.steps;
    } catch (geminiErr: unknown) {
      const errMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      console.warn("Gemini itinerary failed:", errMsg);
      if (!hasDeepSeek) throw geminiErr;
    }
  }

  if (!steps && hasDeepSeek) {
    console.log("Falling back to DeepSeek for itinerary...");
    const deepseek = createOpenAI({
      apiKey: process.env.DEEP_SEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
    const result = await generateText({
      model: deepseek("deepseek-chat"),
      tools: { calculate_itinerary: calculateItineraryTool },
      stopWhen: stepCountIs(10),
      prompt,
    });
    steps = result.steps;
  }

  if (!steps) return null;

  // Extract tool results from steps
  const toolResults: unknown[] = [];
  for (const step of steps) {
    if (step.toolResults) {
      for (const result of step.toolResults) {
        if ("output" in result) {
          toolResults.push(result.output);
        }
      }
    }
  }

  // We need exactly 3 route results
  if (toolResults.length >= 3) {
    return {
      destination,
      arrivalTime,
      departureTime,
      routes: toolResults.slice(0, 3),
    };
  }

  // If AI didn't produce 3 routes, fall back to local engine
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { acceptedCards, arrivalTime, departureTime, destination, answers } = body;

    // Validate time window
    const timeResult = validateTimeWindow(arrivalTime, departureTime);
    if (!timeResult.valid) {
      return NextResponse.json({ error: timeResult.error }, { status: 400 });
    }

    // Filter to activity cards only
    const activityCards: ActivityCard[] = (acceptedCards ?? []).filter(
      (c: { type: string }) => c.type === "activity"
    );

    if (activityCards.length < 1) {
      return NextResponse.json(
        { error: "Aiyoh, no activity cards found lah! Go back and swipe some activities." },
        { status: 400 }
      );
    }

    const hasAnyAiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here") ||
      (process.env.DEEP_SEEK_API_KEY && process.env.DEEP_SEEK_API_KEY !== "your_deepseek_api_key_here");

    let itinerary;

    if (hasAnyAiKey) {
      // Try AI-powered itinerary generation
      try {
        const aiResult = await generateAIItinerary(
          activityCards,
          arrivalTime,
          departureTime,
          destination,
          answers
        );

        if (aiResult) {
          // Validate AI output
          const parsed = ItineraryResultSchema.safeParse(aiResult);
          if (parsed.success) {
            return NextResponse.json({ itinerary: parsed.data });
          }
          console.warn("AI itinerary failed validation, falling back to local engine");
        }
      } catch (aiErr) {
        console.warn("AI itinerary generation failed, falling back to local engine:", aiErr);
      }
    }

    // Local engine fallback (always works, no API key needed)
    itinerary = generateLocalItinerary(activityCards, arrivalTime, departureTime, destination);

    // Validate output
    const parsed = ItineraryResultSchema.safeParse(itinerary);
    if (!parsed.success) {
      console.error("Itinerary schema validation failed:", parsed.error);
      return NextResponse.json(
        { error: "Aiyoh, itinerary generation failed validation lah. Jom try again?" },
        { status: 500 }
      );
    }

    return NextResponse.json({ itinerary: parsed.data });
  } catch (err) {
    console.error("Generate itinerary error:", err);
    return NextResponse.json(
      { error: "Aiyoh, something went wrong generating your itinerary lah. Jom try again?" },
      { status: 500 }
    );
  }
}
