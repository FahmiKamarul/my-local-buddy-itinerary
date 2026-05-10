import { buildRequestBody, SearchGooglePlacesInput } from '../search-google-places';

describe('buildRequestBody', () => {
  it('sets textQuery from input.query', () => {
    const input: SearchGooglePlacesInput = {
      query: 'best nasi lemak in Melaka',
      maxResults: 5,
    };

    const body = buildRequestBody(input);
    expect(body.textQuery).toBe('best nasi lemak in Melaka');
  });

  it('sets maxResultCount from input.maxResults', () => {
    const input: SearchGooglePlacesInput = {
      query: 'museums',
      maxResults: 3,
    };

    const body = buildRequestBody(input);
    expect(body.maxResultCount).toBe(3);
  });

  it('sets languageCode to "ms" for hyperlocal Malaysian results', () => {
    const input: SearchGooglePlacesInput = {
      query: 'cafes',
      maxResults: 5,
    };

    const body = buildRequestBody(input);
    expect(body.languageCode).toBe('ms');
  });

  it('does not include locationBias when not provided', () => {
    const input: SearchGooglePlacesInput = {
      query: 'restaurants',
      maxResults: 5,
    };

    const body = buildRequestBody(input);
    expect(body.locationBias).toBeUndefined();
  });

  it('includes locationBias.circle when locationBias is provided', () => {
    const input: SearchGooglePlacesInput = {
      query: 'restaurants near me',
      maxResults: 5,
      locationBias: {
        latitude: 2.1896,
        longitude: 102.2501,
        radiusMeters: 3000,
      },
    };

    const body = buildRequestBody(input);
    expect(body.locationBias).toEqual({
      circle: {
        center: {
          latitude: 2.1896,
          longitude: 102.2501,
        },
        radius: 3000,
      },
    });
  });

  it('uses the correct structure for the full request body with locationBias', () => {
    const input: SearchGooglePlacesInput = {
      query: 'Jonker Street food',
      maxResults: 10,
      locationBias: {
        latitude: 2.1946,
        longitude: 102.2478,
        radiusMeters: 1000,
      },
    };

    const body = buildRequestBody(input);
    expect(body).toEqual({
      textQuery: 'Jonker Street food',
      maxResultCount: 10,
      languageCode: 'ms',
      locationBias: {
        circle: {
          center: {
            latitude: 2.1946,
            longitude: 102.2478,
          },
          radius: 1000,
        },
      },
    });
  });
});
