import { NextResponse } from "next/server";

/**
 * Proxy route for Google Places photos.
 * Fetches the photo server-side using the API key and returns the image directly.
 * This avoids exposing the API key in client-side URLs and handles CORS.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");

  if (!ref) {
    return new NextResponse("Missing ref parameter", { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return new NextResponse("API key not configured", { status: 500 });
  }

  try {
    const photoUrl = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=400&maxWidthPx=400&key=${apiKey}&skipHttpRedirect=true`;

    const response = await fetch(photoUrl);

    if (!response.ok) {
      // If skipHttpRedirect didn't work, try direct fetch (follows redirect)
      const directUrl = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=400&maxWidthPx=400&key=${apiKey}`;
      const directResponse = await fetch(directUrl);

      if (!directResponse.ok) {
        return new NextResponse("Photo not found", { status: 404 });
      }

      // Return the image directly
      const imageBuffer = await directResponse.arrayBuffer();
      return new NextResponse(imageBuffer, {
        headers: {
          "Content-Type": directResponse.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=86400", // Cache for 24h
        },
      });
    }

    // Parse the JSON response to get the photoUri
    const data = await response.json();
    if (data.photoUri) {
      // Redirect to the actual photo URL
      return NextResponse.redirect(data.photoUri);
    }

    return new NextResponse("Photo URI not found", { status: 404 });
  } catch (error) {
    console.error("Place photo proxy error:", error);
    return new NextResponse("Error fetching photo", { status: 500 });
  }
}
