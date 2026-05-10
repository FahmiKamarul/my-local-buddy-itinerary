import { z } from 'zod';

// ---------------------------------------------------------------------------
// CardSchema
// Base schema for all cards (activity and question types)
// Validates: Requirements 9.1, 2.3
// ---------------------------------------------------------------------------
export const CardSchema = z.object({
  id: z.uuid(),
  type: z.enum(['activity', 'question']),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(300),
  // Activity-only fields (optional on question cards)
  location: z.string().min(1).max(100).optional(),
  baseDuration: z.number().int().positive().max(720).optional(), // minutes
  price: z
    .string()
    .regex(/^(Free|RM\s?\d+(\.\d+)?(\s?[-–]\s?RM?\s?\d+(\.\d+)?)?)$/)
    .optional(),
  priority: z.enum(['High', 'Medium', 'Low']).optional(),
  category: z
    .enum(['Food', 'Culture', 'Nature', 'Shopping', 'Entertainment', 'Other'])
    .optional(),
});

export type Card = z.infer<typeof CardSchema>;

// ---------------------------------------------------------------------------
// ActivityCardSchema
// Narrowed schema for activity cards — all activity fields are required
// Validates: Requirements 9.1, 2.3
// ---------------------------------------------------------------------------
export const ActivityCardSchema = CardSchema.extend({
  type: z.literal('activity'),
  location: z.string().min(1).max(100),
  baseDuration: z.number().int().positive().max(720),
  price: z.string().regex(/^(Free|RM\s?\d+(\.\d+)?(\s?[-–]\s?RM?\s?\d+(\.\d+)?)?)$/),
  priority: z.enum(['High', 'Medium', 'Low']),
  category: z.enum([
    'Food',
    'Culture',
    'Nature',
    'Shopping',
    'Entertainment',
    'Other',
  ]),
});

export type ActivityCard = z.infer<typeof ActivityCardSchema>;

// ---------------------------------------------------------------------------
// CardDeckSchema
// A deck of 8–15 cards with at least 3 question cards and 4 activity cards
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------
export const CardDeckSchema = z
  .object({
    destination: z.string(),
    cards: z.array(CardSchema).min(4).max(20),
  })
  .refine(
    (deck) => deck.cards.filter((c) => c.type === 'activity').length >= 4,
    { message: 'Deck must contain at least 4 Activity Cards' }
  );

export type CardDeck = z.infer<typeof CardDeckSchema>;

// ---------------------------------------------------------------------------
// ScheduledActivitySchema
// A single activity slot in a generated itinerary route
// Validates: Requirements 9.2
// ---------------------------------------------------------------------------
export const ScheduledActivitySchema = z.object({
  cardTitle: z.string(),
  location: z.string(),
  price: z.string(),
  priority: z.enum(['High', 'Medium', 'Low']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
  endTime: z.string().regex(/^\d{2}:\d{2}$/),   // HH:MM
  bufferedDuration: z.number().int().positive(),  // minutes
  isRestInterval: z.boolean().default(false),     // Santai rest slots
});

export type ScheduledActivity = z.infer<typeof ScheduledActivitySchema>;

// ---------------------------------------------------------------------------
// RouteItinerarySchema
// One of the three route variants (optimized, makan-focused, santai)
// Validates: Requirements 9.2, 4.6
// ---------------------------------------------------------------------------
export const RouteItinerarySchema = z.object({
  route: z.enum(['optimized', 'makan-focused', 'santai']),
  activities: z.array(ScheduledActivitySchema).min(1).max(20),
  totalDuration: z.number().int().positive().max(1440), // minutes, max 24h
  droppedCards: z.array(z.string()).default([]),         // titles of dropped cards
  warningMessage: z.string().optional(),                 // shown when cards were dropped
});

export type RouteItinerary = z.infer<typeof RouteItinerarySchema>;

// ---------------------------------------------------------------------------
// ItineraryResultSchema
// The full itinerary result containing all three route variants
// Validates: Requirements 9.2, 4.6
// ---------------------------------------------------------------------------
export const ItineraryResultSchema = z.object({
  destination: z.string(),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/),
  routes: z.tuple([
    RouteItinerarySchema,
    RouteItinerarySchema,
    RouteItinerarySchema,
  ]),
});

export type ItineraryResult = z.infer<typeof ItineraryResultSchema>;
