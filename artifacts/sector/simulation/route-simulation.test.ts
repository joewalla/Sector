import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
// Node's built-in TypeScript stripping runs this without Metro or extra packages.
// @ts-ignore Node requires the source extension; Expo never imports this test.
import { buildSimulationRoute, sampleSimulation } from './route-simulation.ts';

const route: RoutePreviewResponse = {
  distanceMeters: 1_000,
  durationSeconds: 100,
  attribution: '© Mapbox',
  geometry: [
    { latitude: 51.5, longitude: -0.12 },
    { latitude: 51.5, longitude: -0.12 },
    { latitude: 51.5, longitude: -0.11 },
    { latitude: 51.51, longitude: -0.11 },
  ],
  steps: [
    { instruction: 'Head east', roadName: 'A', maneuverType: 'depart', distanceMeters: 600, durationSeconds: 40 },
    { instruction: 'Turn left', roadName: 'B', maneuverType: 'turn', distanceMeters: 400, durationSeconds: 60 },
    { instruction: 'Arrive on the right', roadName: '', maneuverType: 'arrive', distanceMeters: 0, durationSeconds: 0 },
  ],
};

test('starts at actual origin, switches instructions at the step boundary and arrives exactly', () => {
  const model = buildSimulationRoute(route);
  const start = sampleSimulation(model, 0);
  assert.deepEqual(start.position, route.geometry[0]);
  assert.equal(start.instruction, 'Head east');
  assert.equal(start.nextInstruction, 'Turn left');
  assert.equal(start.distanceToNextMeters, 600);
  assert.equal(start.finished, false);
  const turn = sampleSimulation(model, 40);
  assert.equal(turn.instruction, 'Turn left');
  assert.equal(turn.traveledMeters, 600);
  assert.equal(turn.distanceToNextMeters, 400);
  assert.equal(turn.remainingSeconds, 60);
  const done = sampleSimulation(model, 100);
  assert.equal(done.instruction, 'Arrive on the right');
  assert.deepEqual(done.position, route.geometry.at(-1));
  assert.equal(done.progress, 1);
  assert.equal(done.finished, true);
  assert.equal(done.remainingMeters, 0);
  assert.equal(done.remainingSeconds, 0);
  assert.equal(done.nextInstruction, null);
});

test('interpolates along route line and never moves backwards', () => {
  const model = buildSimulationRoute(route);
  let previous = -1;
  for (let t = 0; t <= 100; t += 0.5) {
    const sample = sampleSimulation(model, t);
    assert.ok(sample.traveledMeters >= previous);
    assert.ok(Number.isFinite(sample.position.latitude));
    assert.ok(Number.isFinite(sample.position.longitude));
    assert.ok(sample.position.latitude >= 51.5 && sample.position.latitude <= 51.51);
    assert.ok(sample.position.longitude >= -0.12 && sample.position.longitude <= -0.11);
    assert.ok(sample.progress >= 0 && sample.progress <= 1);
    previous = sample.traveledMeters;
  }
});

test('clamps invalid elapsed time and overshoot', () => {
  const model = buildSimulationRoute(route);
  assert.equal(sampleSimulation(model, -10).traveledMeters, 0);
  assert.equal(sampleSimulation(model, NaN).traveledMeters, 0);
  assert.equal(sampleSimulation(model, Infinity).finished, true);
  assert.equal(sampleSimulation(model, 999).traveledMeters, 1_000);
});

test('supports missing steps without inventing manoeuvres', () => {
  const model = buildSimulationRoute({ ...route, steps: [] });
  assert.equal(sampleSimulation(model, 50).traveledMeters, 500);
  assert.equal(sampleSimulation(model, 50).instruction, 'Follow the route to your destination');
  assert.equal(sampleSimulation(model, 100).finished, true);
});

test('normalizes rounded step totals to route totals', () => {
  const model = buildSimulationRoute({
    ...route,
    distanceMeters: 1_001,
    durationSeconds: 101,
  });
  const done = sampleSimulation(model, 101);
  assert.equal(done.traveledMeters, 1_001);
  assert.equal(done.remainingSeconds, 0);
});

test('handles zero-duration moving steps without divisions by zero', () => {
  const model = buildSimulationRoute({
    ...route,
    steps: route.steps.map((step) => ({ ...step, durationSeconds: 0 })),
  });
  assert.equal(sampleSimulation(model, 30).traveledMeters, 300);
  assert.equal(sampleSimulation(model, 60).instruction, 'Turn left');
  assert.equal(sampleSimulation(model, 100).finished, true);
});

test('rejects invalid route data rather than rendering a fake drive', () => {
  assert.throws(() => buildSimulationRoute({ ...route, geometry: [] }));
  assert.throws(() => buildSimulationRoute({ ...route, durationSeconds: 0 }));
  assert.throws(() => buildSimulationRoute({ ...route, distanceMeters: NaN }));
  assert.throws(() => buildSimulationRoute({ ...route, geometry: [route.geometry[0], route.geometry[0]] }));
  assert.throws(() => buildSimulationRoute({
    ...route,
    steps: [{ ...route.steps[0], distanceMeters: -1 }],
  }));
});
