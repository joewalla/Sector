import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
// @ts-ignore Node's TypeScript stripping requires source extensions.
import { advancePlaybackClock, buildSimulationRoute, sampleSimulation } from './route-simulation.ts';
// @ts-ignore Node's TypeScript stripping requires source extensions.
import { buildSimulationSectors, sampleSectorSplits, PRACTICE_SECTOR_COUNTS } from './sector-timing.ts';
// @ts-ignore Node's TypeScript stripping requires source extensions.
import { configureSimulatedStop, sampleSimulatedStop, SIMULATED_STOP_DURATIONS } from './simulated-stop.ts';

const route: RoutePreviewResponse = {
  distanceMeters: 900, durationSeconds: 120, attribution: '© Mapbox',
  geometry: [{ latitude: 51.5, longitude: -0.1 }, { latitude: 51.51, longitude: -0.1 }],
  steps: [
    { instruction: 'Head north', roadName: '', maneuverType: 'depart', distanceMeters: 300, durationSeconds: 30 },
    { instruction: 'Continue', roadName: '', maneuverType: 'continue', distanceMeters: 600, durationSeconds: 90 },
  ],
};
const reference = buildSimulationRoute(route);
const config = { sectorId: 2, durationSeconds: 30 as const };

test('stop is halfway through selected sector, adds exact time and leaves reference untouched', () => {
  const snapshot = JSON.stringify(reference);
  const { model, stop } = configureSimulatedStop(reference, 3, config);
  assert.equal(stop?.meters, 450);
  assert.equal(stop?.startSeconds, 52.5);
  assert.equal(stop?.endSeconds, 82.5);
  assert.equal(model.durationSeconds, 150);
  assert.equal(model.distanceMeters, 900);
  assert.equal(JSON.stringify(reference), snapshot);
  assert.deepEqual(model.geometry, reference.geometry);
});

test('marker stays stationary throughout synthetic stop and resumes continuously', () => {
  const { model, stop } = configureSimulatedStop(reference, 3, config);
  assert.ok(stop);
  const start = sampleSimulation(model, stop.startSeconds);
  assert.match(start.instruction, /simulated stop/);
  assert.equal(start.traveledMeters, 450);
  for (const fraction of [0.1, 0.5, 0.999]) {
    const held = sampleSimulation(model, stop.startSeconds + stop.durationSeconds * fraction);
    assert.deepEqual(held.position, start.position);
    assert.equal(held.traveledMeters, 450);
  }
  assert.deepEqual(sampleSimulation(model, stop.endSeconds).position, start.position);
  assert.ok(sampleSimulation(model, stop.endSeconds + 1).traveledMeters > 450);
  assert.deepEqual(sampleSimulation(model, model.durationSeconds).position, route.geometry.at(-1));
});

test('only selected sector receives delay while cumulative times shift after it', () => {
  const { model } = configureSimulatedStop(reference, 3, config);
  const sectors = buildSimulationSectors(model, 3);
  assert.deepEqual(sectors.map((s) => s.durationSeconds), [30, 75, 45]);
  assert.deepEqual(sectors.map((s) => s.endSeconds), [30, 105, 150]);
  assert.deepEqual(sampleSectorSplits(sectors, 120).map((s) => s.status), ['complete', 'complete', 'active']);
  const end = sampleSectorSplits(sectors, 150);
  assert.ok(end.every((s) => s.status === 'complete'));
  assert.equal(end.reduce((sum, s) => sum + s.splitSeconds, 0), model.durationSeconds);
});

test('all offered sector counts, stop sectors and durations preserve exact attribution', () => {
  for (const count of PRACTICE_SECTOR_COUNTS) {
    const before = buildSimulationSectors(reference, count);
    for (let sectorId = 1; sectorId <= count; sectorId++) {
      for (const durationSeconds of SIMULATED_STOP_DURATIONS) {
        const { model } = configureSimulatedStop(reference, count, { sectorId, durationSeconds });
        const after = buildSimulationSectors(model, count);
        after.forEach((sector, i) => {
          const expected = before[i].durationSeconds + (i + 1 === sectorId ? durationSeconds : 0);
          assert.ok(Math.abs(sector.durationSeconds - expected) < 1e-8);
          assert.ok(Math.abs(sampleSimulation(model, sector.endSeconds).traveledMeters - sector.endMeters) < 1e-8);
        });
        assert.equal(model.durationSeconds, reference.durationSeconds + durationSeconds);
      }
    }
  }
});

test('early endings show only stop time actually reached', () => {
  const { stop } = configureSimulatedStop(reference, 3, config);
  assert.deepEqual(sampleSimulatedStop(stop, 20), { phase: 'upcoming', elapsedSeconds: 0, remainingSeconds: 30 });
  assert.deepEqual(sampleSimulatedStop(stop, 62.5), { phase: 'holding', elapsedSeconds: 10, remainingSeconds: 20 });
  assert.deepEqual(sampleSimulatedStop(stop, 82.5), { phase: 'passed', elapsedSeconds: 30, remainingSeconds: 0 });
  assert.deepEqual(sampleSimulatedStop(null, 100), { phase: 'disabled', elapsedSeconds: 0, remainingSeconds: 0 });
});

test('pause/resume freezes synthetic stop countdown and ignores background wall time', () => {
  const { model, stop } = configureSimulatedStop(reference, 3, config);
  let elapsed = 62.5;
  const held = sampleSimulatedStop(stop, elapsed);
  elapsed = advancePlaybackClock({
    elapsedSeconds: elapsed, deltaSeconds: 600, rate: 120, durationSeconds: model.durationSeconds, running: false,
  });
  assert.equal(elapsed, 62.5);
  assert.deepEqual(sampleSimulatedStop(stop, elapsed), held);
  elapsed = advancePlaybackClock({
    elapsedSeconds: elapsed, deltaSeconds: 0.5, rate: 20, durationSeconds: model.durationSeconds, running: true,
  });
  assert.equal(elapsed, 72.5);
  assert.equal(sampleSimulatedStop(stop, elapsed).remainingSeconds, 10);
  assert.equal(sampleSimulation(model, elapsed).traveledMeters, 450);
});

test('accelerated and delayed ticks produce identical final splits and replay comparisons', () => {
  const { model } = configureSimulatedStop(reference, 3, config);
  const sectors = buildSimulationSectors(model, 3);
  const expected = sampleSectorSplits(sectors, model.durationSeconds);
  for (const rate of [1, 20, 60, 120]) {
    for (const tick of [0.25, 100]) {
      let elapsed = 0;
      while (elapsed < model.durationSeconds) {
        elapsed = advancePlaybackClock({
          elapsedSeconds: elapsed, deltaSeconds: tick, rate, durationSeconds: model.durationSeconds, running: true,
        });
      }
      assert.deepEqual(sampleSectorSplits(sectors, elapsed), expected);
    }
  }
});

test('off is unchanged; configuration and clock reject invalid values', () => {
  const off = configureSimulatedStop(reference, 3, { sectorId: 1, durationSeconds: 0 });
  assert.equal(off.model, reference);
  assert.equal(off.stop, null);
  for (const sectorId of [0, -1, 1.5, 4, NaN]) {
    assert.throws(() => configureSimulatedStop(reference, 3, { sectorId, durationSeconds: 30 }));
  }
  for (const durationSeconds of [-1, 1, 121, Infinity]) {
    // @ts-ignore Deliberately invalid runtime input.
    assert.throws(() => configureSimulatedStop(reference, 3, { sectorId: 1, durationSeconds }));
  }
  assert.throws(() => advancePlaybackClock({
    elapsedSeconds: 0, deltaSeconds: -1, rate: 1, durationSeconds: 100, running: true,
  }));
});
