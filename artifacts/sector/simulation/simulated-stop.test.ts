import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
// @ts-ignore Node's TypeScript stripping requires source extensions.
import { advancePlaybackClock, buildSimulationRoute, sampleSimulation } from './route-simulation.ts';
// @ts-ignore Node's TypeScript stripping requires source extensions.
import { buildSimulationSectors, sampleSectorSplits, PRACTICE_SECTOR_COUNTS } from './sector-timing.ts';
// @ts-ignore Node's TypeScript stripping requires source extensions.
import { configureSimulatedStop, configureSimulatedStops, sampleSimulatedStop, SIMULATED_STOP_DURATIONS, MAX_SIMULATED_STOPS } from './simulated-stop.ts';

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

test('out-of-order sectors use reference times plus every earlier hold, not compounded models', () => {
  const snapshot = JSON.stringify(reference);
  const { model, stops } = configureSimulatedStops(reference, 3, [
    { sectorId: 3, durationSeconds: 60 },
    { sectorId: 1, durationSeconds: 10 },
    { sectorId: 2, durationSeconds: 30 },
  ]);
  assert.deepEqual(stops.map((s) => s.configIndex), [1, 2, 0]);
  assert.deepEqual(stops.map((s) => s.meters), [150, 450, 750]);
  assert.deepEqual(stops.map((s) => s.referenceStartSeconds), [15, 52.5, 97.5]);
  assert.deepEqual(stops.map((s) => s.startSeconds), [15, 62.5, 137.5]);
  assert.deepEqual(stops.map((s) => s.endSeconds), [25, 92.5, 197.5]);
  assert.deepEqual(buildSimulationSectors(model, 3).map((s) => s.durationSeconds), [40, 75, 105]);
  assert.deepEqual(buildSimulationSectors(model, 3).map((s) => s.endSeconds), [40, 115, 220]);
  assert.equal(model.durationSeconds, 220);
  assert.equal(JSON.stringify(reference), snapshot);
  assert.deepEqual(model.geometry, reference.geometry);
  for (const stop of stops) {
    const held = sampleSimulation(model, stop.startSeconds + stop.durationSeconds / 2);
    assert.equal(held.traveledMeters, stop.meters);
    assert.deepEqual(held.position, sampleSimulation(model, stop.startSeconds).position);
    assert.ok(sampleSimulation(model, stop.endSeconds + 0.01).traveledMeters > stop.meters);
  }
  model.segments.forEach((segment, index) => {
    assert.ok(segment.endSeconds > segment.startSeconds);
    if (index) {
      assert.equal(segment.startSeconds, model.segments[index - 1].endSeconds);
      assert.equal(segment.startMeters, model.segments[index - 1].endMeters);
    }
  });
});

test('three holds within one moving segment are distinct and belong only to their sector', () => {
  const { model, stops } = configureSimulatedStops(reference, 3, [
    { sectorId: 2, durationSeconds: 10 },
    { sectorId: 2, durationSeconds: 30 },
    { sectorId: 2, durationSeconds: 60 },
  ]);
  assert.deepEqual(stops.map((s) => s.meters), [375, 450, 525]);
  assert.deepEqual(stops.map((s) => s.referenceStartSeconds), [41.25, 52.5, 63.75]);
  assert.deepEqual(stops.map((s) => s.startSeconds), [41.25, 62.5, 103.75]);
  assert.deepEqual(buildSimulationSectors(model, 3).map((s) => s.durationSeconds), [30, 145, 45]);
  stops.forEach((stop, i) => {
    assert.ok(stop.meters > 300 && stop.meters < 600);
    if (i) assert.ok(stop.startSeconds > stops[i - 1].endSeconds);
    assert.equal(sampleSimulation(model, stop.startSeconds + 1).traveledMeters, stop.meters);
  });
});

test('partial endings count earlier full holds, current partial hold and no future hold', () => {
  const { model, stops } = configureSimulatedStops(reference, 3, [
    { sectorId: 1, durationSeconds: 10 },
    { sectorId: 2, durationSeconds: 30 },
    { sectorId: 3, durationSeconds: 60 },
  ]);
  const elapsed = stops[1].startSeconds + 12;
  const consumed = stops.map((stop) => sampleSimulatedStop(stop, elapsed).elapsedSeconds);
  assert.deepEqual(consumed, [10, 12, 0]);
  assert.equal(elapsed - consumed.reduce((sum, seconds) => sum + seconds, 0), stops[1].referenceStartSeconds);
  const splits = sampleSectorSplits(buildSimulationSectors(model, 3), elapsed);
  assert.deepEqual(splits.map((s) => s.status), ['complete', 'active', 'pending']);
  assert.deepEqual(splits.map((s) => s.splitSeconds), [40, 34.5, 0]);
  assert.equal(splits.reduce((sum, s) => sum + s.splitSeconds, 0), elapsed);
  assert.deepEqual(stops.map((stop) => sampleSimulatedStop(stop, 0).elapsedSeconds), [0, 0, 0]);
});

test('multi-stop splits and consumed delays are independent of rate, tick size and pause time', () => {
  const { model, stops } = configureSimulatedStops(reference, 3, [
    { sectorId: 2, durationSeconds: 10 },
    { sectorId: 2, durationSeconds: 30 },
    { sectorId: 3, durationSeconds: 120 },
  ]);
  const sectors = buildSimulationSectors(model, 3);
  const expected = sampleSectorSplits(sectors, model.durationSeconds);
  for (const target of [stops[1].startSeconds + 7, model.durationSeconds]) {
    for (const rate of [1, 20, 60, 120]) {
      for (const tick of [0.25, 100]) {
        let elapsed = 0;
        while (elapsed < target) {
          elapsed = advancePlaybackClock({
            elapsedSeconds: elapsed, deltaSeconds: Math.min(tick, (target - elapsed) / rate),
            rate, durationSeconds: model.durationSeconds, running: true,
          });
        }
        assert.deepEqual(sampleSectorSplits(sectors, elapsed), sampleSectorSplits(sectors, target));
        const beforePause = stops.map((stop) => sampleSimulatedStop(stop, elapsed));
        elapsed = advancePlaybackClock({
          elapsedSeconds: elapsed, deltaSeconds: 600, rate, durationSeconds: model.durationSeconds, running: false,
        });
        assert.deepEqual(stops.map((stop) => sampleSimulatedStop(stop, elapsed)), beforePause);
        if (target === model.durationSeconds) assert.deepEqual(sampleSectorSplits(sectors, elapsed), expected);
      }
    }
  }
  assert.equal(expected.reduce((sum, split) => sum + split.splitSeconds, 0), model.durationSeconds);
});

test('multi-stop bounds, empty scenarios, disabled holds and invalid entries are explicit', () => {
  assert.equal(configureSimulatedStops(reference, 3, []).model, reference);
  assert.deepEqual(configureSimulatedStops(reference, 3, [{ sectorId: 1, durationSeconds: 0 }]).stops, []);
  assert.throws(() => configureSimulatedStops(reference, 3,
    Array.from({ length: MAX_SIMULATED_STOPS + 1 }, () => config)));
  for (const sectorId of [0, 4, 1.5, NaN]) {
    assert.throws(() => configureSimulatedStops(reference, 3, [config, { sectorId, durationSeconds: 10 }]));
  }
  // @ts-ignore Deliberately invalid runtime input.
  assert.throws(() => configureSimulatedStops(reference, 3, [config, { sectorId: 1, durationSeconds: 15 }]));
});

test('a hold at a step join preserves provider stationary intervals and the reference timeline', () => {
  const withStationary = buildSimulationRoute({
    ...route,
    durationSeconds: 100,
    steps: [
      { ...route.steps[0], distanceMeters: 150, durationSeconds: 10 },
      { ...route.steps[1], distanceMeters: 0, durationSeconds: 20 },
      { ...route.steps[1], distanceMeters: 750, durationSeconds: 70 },
    ],
  });
  const snapshot = JSON.stringify(withStationary);
  const { model, stops } = configureSimulatedStops(withStationary, 3, [
    { sectorId: 1, durationSeconds: 10 },
    { sectorId: 3, durationSeconds: 30 },
  ]);
  assert.equal(stops[0].referenceStartSeconds, 10);
  assert.equal(sampleSimulation(model, 25).traveledMeters, 150); // Provider hold, after synthetic hold.
  assert.equal(model.durationSeconds, 140);
  assert.equal(JSON.stringify(withStationary), snapshot);
  const original = buildSimulationSectors(withStationary, 3);
  buildSimulationSectors(model, 3).forEach((sector, index) => {
    const added = index === 0 ? 10 : index === 2 ? 30 : 0;
    assert.ok(Math.abs(sector.durationSeconds - original[index].durationSeconds - added) < 1e-8);
  });
});
