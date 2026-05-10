import { buildRequestBody, mapPlaceResponse, type SearchGooglePlacesInput, type GooglePlace } from './lib/tools/search-google-places';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Manually load .env.local
try {
  const envPath = resolve(__dirname, '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch (e) {
  console.error('Could not load .env.local:', (e as Error).message);
}

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  console.log('API Key set:', !!apiKey);
  console.log('API Key prefix:', apiKey?.slice(0, 8) + '...');
  console.log('');

  const input: SearchGooglePlacesInput = {
    query: 'nasi lemak in Melaka',
    maxResults: 3,
  };

  const requestBody = buildRequestBody(input);
  console.log('Request body:', JSON.stringify(requestBody, null, 2));
  console.log('');

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.rating',
    'places.userRatingCount',
    'places.priceLevel',
    'places.types',
    'places.currentOpeningHours',
    'places.primaryType',
    'places.editorialSummary',
  ].join(',');

  console.log('Calling Google Places API...\n');

  const response = await fetch(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey!,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(requestBody),
    }
  );

  console.log('Status:', response.status, response.statusText);

  const data = await response.json();

  if (!response.ok) {
    console.log('Error response:', JSON.stringify(data, null, 2));
    return;
  }

  const places: GooglePlace[] = (data.places ?? [])
    .slice(0, input.maxResults)
    .map(mapPlaceResponse);

  console.log(`\nGot ${places.length} results:\n`);
  places.forEach((place, i) => {
    console.log(`${i + 1}. ${place.name}`);
    console.log(`   Place ID: ${place.placeId}`);
    console.log(`   Address: ${place.formattedAddress}`);
    console.log(`   Location: ${place.location.latitude}, ${place.location.longitude}`);
    console.log(`   Rating: ${place.rating ?? 'N/A'} (${place.userRatingCount ?? 0} reviews)`);
    console.log(`   Price: ${place.priceLevel ?? 'N/A'}`);
    console.log(`   Open now: ${place.openNow ?? 'unknown'}`);
    console.log(`   Types: ${place.types.join(', ') || 'none'}`);
    console.log(`   Summary: ${place.editorialSummary ?? 'N/A'}`);
    console.log('');
  });
}

main().catch(console.error);
