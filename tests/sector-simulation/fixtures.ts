/**
 * Explicit browser-test fixtures, never loaded by the app. These simplified
 * coordinates/timings are synthetic, NOT live Mapbox routes or driving data.
 */
export function londonFixture(durationSeconds = 180) {
  return {
    distanceMeters: 900,
    durationSeconds,
    attribution: 'Synthetic browser regression fixture · not live Mapbox data',
    geometry: [
      { latitude: 51.5007, longitude: -0.1276 },
      { latitude: 51.5050, longitude: -0.1100 },
      { latitude: 51.5081, longitude: -0.0754 },
    ],
    steps: [
      { instruction: 'Fixture: depart Westminster', roadName: 'Test road A', distanceMeters: 300, durationSeconds: durationSeconds / 3, maneuverType: 'depart' },
      { instruction: 'Fixture: continue along test road', roadName: 'Test road B', distanceMeters: 300, durationSeconds: durationSeconds / 3, maneuverType: 'continue' },
      { instruction: 'Fixture: approach destination', roadName: 'Test road C', distanceMeters: 300, durationSeconds: durationSeconds / 3, maneuverType: 'continue' },
      { instruction: 'Fixture: arrived', roadName: '', distanceMeters: 0, durationSeconds: 0, maneuverType: 'arrive' },
    ],
  };
}

export const unavailableRouteFixture = { error: 'Synthetic fixture: route service unavailable' };
export const failedRouteFixture = { error: 'Synthetic fixture: route provider failed' };

/** Deliberately invalid wire payloads; do not coerce these into valid client types. */
export function unusableRouteFixtures() {
  const route = londonFixture();
  return [
    { name: 'empty geometry', response: { ...route, geometry: [] } },
    { name: 'single point', response: { ...route, geometry: route.geometry.slice(0, 1) } },
    { name: 'coincident points', response: { ...route, geometry: [route.geometry[0], route.geometry[0]] } },
    { name: 'out-of-range coordinate', response: { ...route, geometry: [{ latitude: 100, longitude: 0 }, route.geometry[1]] } },
    { name: 'missing coordinate', response: { ...route, geometry: [{ latitude: 51.5 }, route.geometry[1]] } },
    { name: 'null geometry', response: { ...route, geometry: null } },
    { name: 'null point', response: { ...route, geometry: [null, route.geometry[1]] } },
    { name: 'zero distance', response: { ...route, distanceMeters: 0 } },
  ];
}

/** Invalid successful responses: no fallback steps, metrics, or replacement route. */
export function malformedRouteEnvelopeFixtures() {
  const route = londonFixture();
  const { steps: _steps, ...withoutSteps } = route;
  const { distanceMeters: _distance, ...withoutDistance } = route;
  const { durationSeconds: _duration, ...withoutDuration } = route;
  const json = (name: string, response: unknown) => ({
    name, response: { json: response },
  });
  return [
    json('missing steps', withoutSteps),
    json('null steps', { ...route, steps: null }),
    json('empty steps', { ...route, steps: [] }),
    json('zero-weight steps', { ...route, steps: route.steps.map((step) => ({
      ...step, distanceMeters: 0, durationSeconds: 0,
    })) }),
    json('arrival-only steps', { ...route, steps: [route.steps[3]] }),
    json('blank instruction', { ...route, steps: [{ ...route.steps[0], instruction: '  ' }] }),
    json('non-array steps', { ...route, steps: {} }),
    json('null instruction step', { ...route, steps: [null] }),
    json('non-text instruction', { ...route, steps: [{ ...route.steps[0], instruction: {} }] }),
    json('missing step duration', { ...route, steps: [{ instruction: 'Incomplete instruction' }] }),
    json('missing distance', withoutDistance),
    json('missing duration', withoutDuration),
    json('null metrics', { ...route, distanceMeters: null, durationSeconds: null }),
    json('string metrics', { ...route, distanceMeters: '900', durationSeconds: '180' }),
    json('negative duration', { ...route, durationSeconds: -1 }),
    json('null envelope', null),
    json('empty envelope', {}),
    json('array envelope', [route]),
    {
      name: 'HTML success',
      response: { contentType: 'text/html', body: '<html><body>Upstream unavailable</body></html>' },
    },
    {
      name: 'invalid JSON success',
      response: { contentType: 'application/json', body: '{"steps":' },
    },
    {
      name: 'empty JSON success',
      response: { contentType: 'application/json', body: '' },
    },
  ];
}

export function placesFixture() {
  return {
    attribution: 'Synthetic browser search fixture · not live Mapbox data',
    results: [
      { id: 'fixture-museum', name: 'Fixture Museum', fullAddress: 'Synthetic Museum Road, London', featureType: 'poi', latitude: 51.51, longitude: -0.1 },
      { id: 'fixture-library', name: 'Fixture Library', fullAddress: 'Synthetic Library Road, London', featureType: 'poi', latitude: 51.52, longitude: -0.11 },
    ],
  };
}
