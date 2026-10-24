import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
import { clusterPracticeStops, type ProjectedPracticeStop } from './practice-stop-markers.ts';
import { buildSimulationRoute, simulationPositionAtDistance, sampleSimulation } from './route-simulation.ts';
import { configureSimulatedStops } from './simulated-stop.ts';

function marker(number: number, x: number, y: number): ProjectedPracticeStop {
  return { number, x, y, position: { latitude: 51 + y / 1000, longitude: x / 1000 } };
}

test('empty and separated stops do not produce phantom markers or clusters', () => {
  assert.deepEqual(clusterPracticeStops([]), []);
  const groups = clusterPracticeStops([marker(3, 0, 0), marker(1, 140, 0), marker(2, 0, 90)]);
  assert.deepEqual(groups.map((group) => group.label), ['SIM 3', 'SIM 1', 'SIM 2']);
  assert.ok(groups.every((group) => group.members.length === 1));
});

test('coincident stops retain every configuration number and exact position', () => {
  const stops = [marker(3, 5, 5), marker(1, 5, 5), marker(2, 5, 5)];
  const before = JSON.stringify(stops);
  const [group] = clusterPracticeStops(stops);
  assert.equal(group.label, 'SIM 1, 2, 3');
  assert.equal(group.key, '1-2-3');
  assert.deepEqual(group.members.map((stop) => stop.position), stops.map((stop) => stop.position));
  assert.match(group.description, /Synthetic practice stops 1, 2, 3/);
  assert.match(group.description, /Nearby labels grouped/);
  assert.match(group.description, /Not real roadside stops. No GPS tracking/);
  assert.equal(JSON.stringify(stops), before);
});

test('a nearby bridge merges groups without losing anchors or changing their coordinates', () => {
  const stops = [marker(1, 0, 0), marker(2, 160, 0), marker(3, 80, 0)];
  const [group, extra] = clusterPracticeStops(stops);
  assert.equal(extra, undefined);
  assert.equal(group.label, 'SIM 1, 2, 3');
  assert.equal(group.x, 80);
  assert.deepEqual(group.members, stops);
});

test('out-of-order sectors and disabled entries keep configuration numbers and reference positions', () => {
  const route: RoutePreviewResponse = {
    distanceMeters: 900, durationSeconds: 120, attribution: '© Mapbox',
    geometry: [{ latitude: 51.5, longitude: -0.1 }, { latitude: 51.51, longitude: -0.1 }],
    steps: [],
  };
  const reference = buildSimulationRoute(route);
  const { model, stops } = configureSimulatedStops(reference, 3, [
    { sectorId: 3, durationSeconds: 30 },
    { sectorId: 2, durationSeconds: 0 },
    { sectorId: 1, durationSeconds: 10 },
  ]);
  const markers = stops.map((stop) => ({
    number: stop.configIndex + 1,
    position: simulationPositionAtDistance(reference, stop.meters),
  }));
  assert.deepEqual(markers.map((stop) => stop.number), [3, 1]);
  assert.deepEqual(stops.map((stop) => stop.meters), [150, 750]);
  stops.forEach((stop, index) => {
    assert.deepEqual(markers[index].position, sampleSimulation(model, stop.startSeconds + 5).position);
  });
  const groups = clusterPracticeStops(markers.map((stop) => ({ ...stop, x: 10, y: 10 })));
  assert.equal(groups[0].label, 'SIM 1, 3');
});
