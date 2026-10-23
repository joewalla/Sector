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
