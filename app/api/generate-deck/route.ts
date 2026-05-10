import { NextResponse } from "next/server";
import { isRecognisedLocation } from "@/lib/locations";
import { CardDeckSchema } from "@/lib/schemas";

// For now, return a mock deck so the UI can be tested without an API key
function generateMockDeck(destination: string) {
  const uuid = () => crypto.randomUUID();

  return {
    destination,
    cards: [
      { id: uuid(), type: "question" as const, title: "Do you like street food?", description: "Makan at hawker stalls is the best lah! Cheap and shiok." },
      { id: uuid(), type: "question" as const, title: "Are you into history?", description: "Lepak at old heritage buildings and learn about the past lor." },
      { id: uuid(), type: "question" as const, title: "Do you enjoy nature walks?", description: "Santai walks through parks and gardens — ngam for relaxing." },
      { id: uuid(), type: "activity" as const, title: "Jonker Street Night Market", description: "Makan your way through this famous night market — shiok giler!", location: "Jonker Street, Melaka", baseDuration: 90, price: "RM10-RM30", priority: "High" as const, category: "Food" as const },
      { id: uuid(), type: "activity" as const, title: "A Famosa Fort", description: "Lepak at this iconic Portuguese fort — on-the-way to other spots.", location: "Jalan Kota, Melaka", baseDuration: 30, price: "Free", priority: "Medium" as const, category: "Culture" as const },
      { id: uuid(), type: "activity" as const, title: "Melaka River Cruise", description: "Santai boat ride along the river — boleh see street art and old buildings.", location: "Melaka River", baseDuration: 45, price: "RM30", priority: "High" as const, category: "Nature" as const },
      { id: uuid(), type: "activity" as const, title: "Chicken Rice Ball", description: "Makan the famous Melaka chicken rice balls — ngam for lunch!", location: "Jonker Street", baseDuration: 45, price: "RM8-RM15", priority: "Medium" as const, category: "Food" as const },
      { id: uuid(), type: "activity" as const, title: "The Shore Sky Tower", description: "Shiok views from the top — boleh see the whole city from up there.", location: "The Shore, Melaka", baseDuration: 30, price: "RM25", priority: "Low" as const, category: "Entertainment" as const },
      { id: uuid(), type: "activity" as const, title: "Baba & Nyonya Museum", description: "Lepak and learn about Peranakan culture — very ngam for history lovers.", location: "Heeren Street, Melaka", baseDuration: 60, price: "RM16", priority: "Medium" as const, category: "Culture" as const },
      { id: uuid(), type: "question" as const, title: "Want to try local desserts?", description: "Cendol, ais kacang, kuih — all the sweet makan spots boleh include!" },
      { id: uuid(), type: "activity" as const, title: "Stadthuys & Red Square", description: "On-the-way landmark — lepak for photos at the iconic red building.", location: "Dutch Square, Melaka", baseDuration: 20, price: "Free", priority: "Low" as const, category: "Culture" as const },
    ],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { destination } = body;

    if (!destination || !isRecognisedLocation(destination)) {
      return NextResponse.json(
        { error: "Alamak, we don't recognise that place lah! Try 'Melaka', 'Penang', or 'KL' — we're expanding soon, boleh?" },
        { status: 400 }
      );
    }

    // Generate mock deck (replace with AI call when API key is available)
    const deck = generateMockDeck(destination);

    // Validate against schema
    const parsed = CardDeckSchema.safeParse(deck);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Aiyoh, something went wrong generating your cards. Jom try again?" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deck: parsed.data });
  } catch {
    return NextResponse.json(
      { error: "Aiyoh, something went wrong lah. Jom try again?" },
      { status: 500 }
    );
  }
}
