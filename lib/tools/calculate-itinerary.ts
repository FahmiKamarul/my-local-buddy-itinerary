/**
 * calculate_itinerary — Vercel AI SDK Tool
 *
 * A pure TypeScript tool (no external API calls) that computes a single
 * RouteItinerary from a set of accepted ActivityCards and a time window.
 *
 * The AI calls this tool up to `maxSteps` times — once per route variant
 * (optimized, makan-focused, santai) — and the results are assembled into
 * an ItineraryResult by the route handler.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
  calculateBufferedDuration,
  dropCardsToFitWindow,
  assignStartEndTimes,
  orderOptimized,
  orderMakanFocused,
  orderSantai,
} from '../itinerary-engine';
import { ActivityCardSchema, RouteItinerarySchema, type RouteItinerary } from '../schemas';
import { parseHHMM } from '../time-utils';

const parametersSchema = z.object({
  cards: z.array(ActivityCardSchema).describe('Accepted activity cards from the swipe session'),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/).describe('Arrival time in HH:MM format'),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/).describe('Departure time in HH:MM format'),
  bufferMultiplier: z
    .number()
    .min(1)
    .max(2)
    .default(1.25)
    .describe('Human Error Buffer multiplier — 1.25 for optimized/makan-focused, 1.30 for santai'),
  routeType: z
    .enum(['optimized', 'makan-focused', 'santai'])
    .describe('Which route variant to calculate'),
});

type CalculateItineraryInput = z.infer<typeof parametersSchema>;

export const calculateItineraryTool = tool<CalculateItineraryInput, RouteItinerary>({
  description:
    'Calculate a time-ordered itinerary from accepted activity cards. ' +
    'Applies Human Error Buffers, drops cards that exceed the time window ' +
    '(Low priority first, then Medium, never High), orders activities per ' +
    'the requested route type, and assigns start/end times. ' +
    'Call this tool once per route variant (optimized, makan-focused, santai).',

  inputSchema: parametersSchema,

  execute: async ({ cards, arrivalTime, departureTime, bufferMultiplier, routeType }: CalculateItineraryInput): Promise<RouteItinerary> => {
    const availableMinutes = parseHHMM(departureTime) - parseHHMM(arrivalTime);

    // -----------------------------------------------------------------------
    // Santai route: orderSantai handles its own 1.30× buffer + dropping
    // -----------------------------------------------------------------------
    if (routeType === 'santai') {
      const { orderedCards, droppedCards, warning } = orderSantai(cards, availableMinutes);

      // Assign start/end times with 15-minute rest intervals
      const activities = assignStartEndTimes(orderedCards, arrivalTime, 15);

      const totalDuration = activities.reduce((sum, a) => sum + a.bufferedDuration, 0);

      const result = RouteItinerarySchema.parse({
        route: 'santai',
        activities,
        totalDuration: Math.min(totalDuration, 1440),
        droppedCards: droppedCards.map((c) => c.title),
        warningMessage: warning,
      });

      return result;
    }

    // -----------------------------------------------------------------------
    // Optimized / Makan-Focused: compute buffers, drop, order, assign times
    // -----------------------------------------------------------------------

    // Step 1: Compute bufferedDuration for each card
    const bufferedCards = cards.map((card) => ({
      ...card,
      bufferedDuration: calculateBufferedDuration(card.baseDuration, bufferMultiplier),
    }));

    // Step 2: Drop cards that don't fit the time window
    const { keptCards, droppedCards, warning } = dropCardsToFitWindow(
      bufferedCards,
      availableMinutes
    );

    // Step 3: Order activities per route type
    const orderedCards =
      routeType === 'makan-focused'
        ? orderMakanFocused(keptCards, arrivalTime, departureTime)
        : orderOptimized(keptCards, ''); // destination not needed for MVP ordering

    // Step 4: Assign start/end times (no rest intervals for these routes)
    const activities = assignStartEndTimes(orderedCards, arrivalTime, 0);

    const totalDuration = activities.reduce((sum, a) => sum + a.bufferedDuration, 0);

    const result = RouteItinerarySchema.parse({
      route: routeType,
      activities,
      totalDuration: Math.min(totalDuration, 1440),
      droppedCards: droppedCards.map((c) => c.title),
      warningMessage: warning,
    });

    return result;
  },
});
