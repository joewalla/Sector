import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
// @ts-ignore Node's built-in TypeScript stripping needs source extensions.
import { buildSimulationRoute, sampleSimulation } from './route-simulation.ts';
// @ts-ignore Node's built-in TypeScript stripping needs source extensions.
import { buildSimulationSectors, sampleSectorSplits, PRACTICE_SECTOR_COUNTS } from './sector-timing.ts';

const route: RoutePreviewResponse = {
  distanceMeters: 900,
  durationSeconds: 120,
  attribution: '© Mapbox',
  geometry: [{ latitude: 51.5, longitude: -0.1 }, { latitude: 51.51, longitude: -0.1 }],
  steps: [
    { instruction: 'Head north', roadName: '', maneuverType: 'depart', distanceMeters: 300, durationSeconds: 30 },
    { instruction: 'Continue', roadName: '', maneuverType: 'continue', distanceMeters: 600, durationSeconds: 90 },
  ],
};
const model = buildSimulationRoute(route);
const sectors = buildSimulationSectors(model);

test('three equal-distance sectors use route-specific crossing times, not equal time thirds', () => {
  assert.deepEqual(sectors.map((s) => s.endMeters), [300, 600, 900]);
  assert.deepEqual(sectors.map((s) => s.durationSeconds), [30, 45, 45]);
  assert.deepEqual(sectors.map((s) => s.endSeconds), [30, 75, 120]);
  assert.equal(sectors.reduce((sum, s) => sum + s.durationSeconds, 0), model.durationSeconds);
  assert.deepEqual(sectors[2].endPosition, route.geometry.at(-1));
  sectors.forEach((sector) => {
    assert.ok(Math.abs(sampleSimulation(model, sector.endSeconds).traveledMeters - sector.endMeters) < 1e-8);
  });
});

test('pending, active and complete states are correct exactly at boundaries', () => {
  assert.deepEqual(sampleSectorSplits(sectors, 0).map((s) => s.status), ['active', 'pending', 'pending']);
  const crossing = sampleSectorSplits(sectors, 30);
  assert.deepEqual(crossing.map((s) => s.status), ['complete', 'active', 'pending']);
  assert.equal(crossing[0].splitSeconds, 30);
  assert.equal(crossing[0].cumulativeSeconds, 30);
  assert.equal(crossing[1].splitSeconds, 0);
  assert.equal(crossing[1].cumulativeSeconds, null);
  const active = sampleSectorSplits(sectors, 60);
  assert.equal(active[1].splitSeconds, 30);
  assert.equal(active[2].splitSeconds, 0);
});

test('arbitrary forward and backward inspection keeps marker, instructions and boundaries in sync', () => {
  const snapshot = JSON.stringify(model);
  for (const seconds of [120, 55.25, 0, 75, 29.5, 30, 119.75, 0]) {
    const sample = sampleSimulation(model, seconds);
    const splits = sampleSectorSplits(sectors, seconds);
    assert.equal(sample.remainingSeconds, 120 - seconds);
    assert.equal(sample.instruction, seconds === 120 ? model.arrivalInstruction : seconds < 30 ? 'Head north' : 'Continue');
    const completedMeters = splits.filter((s) => s.status === 'complete').at(-1)?.endMeters ?? 0;
    assert.ok(sample.traveledMeters >= completedMeters);
    const current = splits.find((s) => s.status === 'active');
    if (current) {
      assert.ok(sample.traveledMeters >= current.startMeters);
      assert.ok(sample.traveledMeters <= current.endMeters);
      assert.equal(current.splitSeconds, seconds - current.startSeconds);
    }
    assert.deepEqual(sample.position, sampleSimulation(model, seconds).position);
  }
  assert.equal(JSON.stringify(model), snapshot, 'inspection never mutates the route input');
});

test('one delayed tick crossing every boundary still yields exact splits', () => {
  const completed = sampleSectorSplits(sectors, 10_000);
  assert.ok(completed.every((s) => s.status === 'complete'));
  assert.deepEqual(completed.map((s) => s.splitSeconds), [30, 45, 45]);
  assert.deepEqual(completed.map((s) => s.cumulativeSeconds), [30, 75, 120]);
});

test('different playback speeds and tick intervals produce identical complete comparisons', () => {
  function replay(rate: number, tick: number) {
    let elapsed = 0;
    while (elapsed < model.durationSeconds) elapsed = Math.min(model.durationSeconds, elapsed + rate * tick);
    return sampleSectorSplits(sectors, elapsed);
  }
  const baseline = replay(1, 0.25);
  for (const rate of [20, 60, 120]) {
    assert.deepEqual(replay(rate, 0.25), baseline);
    assert.deepEqual(replay(rate, 4), baseline);
  }
});

test('ending early does not fabricate future split or cumulative times', () => {
  const splits = sampleSectorSplits(sectors, 55);
  assert.equal(splits[0].status, 'complete');
  assert.equal(splits[1].status, 'active');
  assert.equal(splits[1].splitSeconds, 25);
  assert.equal(splits[1].cumulativeSeconds, null);
  assert.equal(splits[2].status, 'pending');
  assert.equal(splits[2].splitSeconds, 0);
  assert.equal(splits[2].cumulativeSeconds, null);
});

test('stationary intervals and single-sector routes retain total estimated time', () => {
  const stationary = buildSimulationRoute({
    ...route,
    steps: [
      { ...route.steps[0], distanceMeters: 0, durationSeconds: 10 },
      { ...route.steps[0], durationSeconds: 20 },
      { ...route.steps[1], durationSeconds: 80 },
      { ...route.steps[0], distanceMeters: 0, durationSeconds: 10 },
    ],
  });
  assert.deepEqual(buildSimulationSectors(stationary).map((s) => s.durationSeconds), [30, 40, 50]);
  assert.equal(buildSimulationSectors(stationary, 1)[0].durationSeconds, 120);
});

test('invalid elapsed values clamp and invalid sector counts reject', () => {
  assert.deepEqual(sampleSectorSplits(sectors, -1), sampleSectorSplits(sectors, 0));
  assert.deepEqual(sampleSectorSplits(sectors, NaN), sampleSectorSplits(sectors, 0));
  assert.ok(sampleSectorSplits(sectors, Infinity).every((s) => s.status === 'complete'));
  for (const count of [0, -1, 1.5, NaN, 21]) assert.throws(() => buildSimulationSectors(model, count));
});

test('every offered practice count previews equal boundaries on the unchanged route model', () => {
  const frozenRoute = JSON.stringify(model);
  assert.deepEqual(PRACTICE_SECTOR_COUNTS, [2, 3, 4, 5]);
  for (const count of PRACTICE_SECTOR_COUNTS) {
    const configured = buildSimulationSectors(model, count);
    assert.equal(configured.length, count);
    configured.forEach((sector, index) => {
      assert.equal(sector.id, index + 1);
      assert.ok(Math.abs((sector.endMeters - sector.startMeters) - model.distanceMeters / count) < 1e-8);
      assert.ok(Math.abs(sampleSimulation(model, sector.endSeconds).traveledMeters - sector.endMeters) < 1e-8);
    });
    const completed = sampleSectorSplits(configured, model.durationSeconds);
    assert.ok(completed.every((s) => s.status === 'complete'));
    assert.ok(Math.abs(completed.reduce((sum, s) => sum + s.splitSeconds, 0) - model.durationSeconds) < 1e-8);
  }
  assert.equal(JSON.stringify(model), frozenRoute);
});

test('reconfiguring and returning to an earlier count does not change the route or its estimates', () => {
  const first = buildSimulationSectors(model, 3);
  buildSimulationSectors(model, 5);
  const again = buildSimulationSectors(model, 3);
  assert.deepEqual(again, first);
  assert.deepEqual(
    sampleSectorSplits(again, model.durationSeconds),
    sampleSectorSplits(first, model.durationSeconds),
  );
});
