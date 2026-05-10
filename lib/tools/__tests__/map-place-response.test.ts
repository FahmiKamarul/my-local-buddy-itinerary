import { mapPlaceResponse } from '../search-google-places';

describe('mapPlaceResponse', () => {
  it('maps a complete API response to GooglePlace schema', () => {
    const apiPlace = {
      id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      displayName: { text: 'Jonker Street Night Market' },
      formattedAddress: 'Jalan Hang Jebat, 75200 Melaka',
      location: { latitude: 2.1946, longitude: 102.2478 },
      rating: 4.5,
      userRatingCount: 1200,
      priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
      types: ['tourist_attraction', 'market'],
      currentOpeningHours: { openNow: true },
      primaryType: 'tourist_attraction',
      editorialSummary: { text: 'A vibrant night market on Jonker Street.' },
    };

    const result = mapPlaceResponse(apiPlace);

    expect(result).toEqual({
      placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      name: 'Jonker Street Night Market',
      formattedAddress: 'Jalan Hang Jebat, 75200 Melaka',
      location: { latitude: 2.1946, longitude: 102.2478 },
      rating: 4.5,
      userRatingCount: 1200,
      priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
      types: ['tourist_attraction', 'market'],
      openNow: true,
      primaryType: 'tourist_attraction',
      editorialSummary: 'A vibrant night market on Jonker Street.',
    });
  });

  it('maps displayName.text to name', () => {
    const apiPlace = {
      id: 'place123',
      displayName: { text: 'Cafe Latte' },
      location: { latitude: 2.0, longitude: 102.0 },
    };

    const result = mapPlaceResponse(apiPlace);
    expect(result.name).toBe('Cafe Latte');
  });

  it('maps id to placeId', () => {
    const apiPlace = {
      id: 'unique-place-id',
      displayName: { text: 'Some Place' },
      location: { latitude: 2.0, longitude: 102.0 },
    };

    const result = mapPlaceResponse(apiPlace);
    expect(result.placeId).toBe('unique-place-id');
  });

  it('maps currentOpeningHours.openNow to openNow', () => {
    const apiPlace = {
      id: 'place1',
      displayName: { text: 'Open Place' },
      location: { latitude: 2.0, longitude: 102.0 },
      currentOpeningHours: { openNow: false },
    };

    const result = mapPlaceResponse(apiPlace);
    expect(result.openNow).toBe(false);
  });

  it('maps editorialSummary.text to editorialSummary', () => {
    const apiPlace = {
      id: 'place1',
      displayName: { text: 'Nice Place' },
      location: { latitude: 2.0, longitude: 102.0 },
      editorialSummary: { text: 'A lovely spot for tourists.' },
    };

    const result = mapPlaceResponse(apiPlace);
    expect(result.editorialSummary).toBe('A lovely spot for tourists.');
  });

  it('defaults name to "Unknown" when displayName is missing', () => {
    const apiPlace = {
      id: 'place1',
      location: { latitude: 2.0, longitude: 102.0 },
    };

    const result = mapPlaceResponse(apiPlace);
    expect(result.name).toBe('Unknown');
  });

  it('defaults name to "Unknown" when displayName.text is missing', () => {
    const apiPlace = {
      id: 'place1',
      displayName: {},
      location: { latitude: 2.0, longitude: 102.0 },
    };

    const result = mapPlaceResponse(apiPlace);
    expect(result.name).toBe('Unknown');
  });

  it('defaults formattedAddress to empty string when missing', () => {
    const apiPlace = {
      id: 'place1',
      displayName: { text: 'Test' },
      location: { latitude: 2.0, longitude: 102.0 },
    };

    const result = mapPlaceResponse(apiPlace);
    expect(result.formattedAddress).toBe('');
  });

  it('defaults types to empty array when missing', () => {
    const apiPlace = {
      id: 'place1',
      displayName: { text: 'Test' },
      location: { latitude: 2.0, longitude: 102.0 },
    };

    const result = mapPlaceResponse(apiPlace);
    expect(result.types).toEqual([]);
  });

  it('handles missing optional fields gracefully', () => {
    const apiPlace = {
      id: 'minimal-place',
      displayName: { text: 'Minimal Place' },
      formattedAddress: '123 Street',
      location: { latitude: 3.0, longitude: 101.0 },
    };

    const result = mapPlaceResponse(apiPlace);

    expect(result.rating).toBeUndefined();
    expect(result.userRatingCount).toBeUndefined();
    expect(result.priceLevel).toBeUndefined();
    expect(result.openNow).toBeUndefined();
    expect(result.primaryType).toBeUndefined();
    expect(result.editorialSummary).toBeUndefined();
  });

  it('defaults location to 0,0 when location is missing', () => {
    const apiPlace = {
      id: 'place1',
      displayName: { text: 'No Location' },
    };

    const result = mapPlaceResponse(apiPlace);
    expect(result.location).toEqual({ latitude: 0, longitude: 0 });
  });
});
