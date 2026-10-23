import type { RoutePreviewResponse } from '@workspace/api-client-react';

type Coordinate = { latitude: number; longitude: number };
type Segment = {
  instruction: string;
  stepIndex: number;
  startSeconds: number;
  endSeconds: number;
  startMeters: number;
  endMeters: number;
};

export type SimulationRoute = {
  durationSeconds: number;
  distanceMeters: number;
  stepCount: number;
  geometry: Coordinate[];
  geometryDistances: number[];
  geometryLength: number;
  segments: Segment[];
  arrivalInstruction: string;
};

export type SimulationSample = {
  position: Coordinate;
  instruction: string;
  nextInstruction: string | null;
  stepIndex: number;
  distanceToNextMeters: number;
  traveledMeters: number;
  remainingMeters: number;
  remainingSeconds: number;
  progress: number;
  finished: boolean;
};

/** Only eligible foreground playback advances time; paused wall time is discarded. */
export function advancePlaybackClock({
  elapsedSeconds, deltaSeconds, rate, durationSeconds, running,
}: {
  elapsedSeconds: number;
  deltaSeconds: number;
  rate: number;
  durationSeconds: number;
  running: boolean;
}): number {
  if (![elapsedSeconds, deltaSeconds, rate, durationSeconds].every(Number.isFinite)
    || deltaSeconds < 0 || rate <= 0 || durationSeconds <= 0) {
    throw new Error('Invalid simulation clock input.');
  }
  const current = Math.max(0, Math.min(durationSeconds, elapsedSeconds));
  return running ? Math.min(durationSeconds, current + deltaSeconds * rate) : current;
}

function distance(a: Coordinate, b: Coordinate): number {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLng = (b.longitude - a.longitude) * radians;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

/**
 * A deterministic playback model, not GPS navigation. Mapbox step distances
 * locate manoeuvres approximately along its simplified overview geometry.
 * Step durations drive playback; this does not predict actual vehicle motion.
 */
export function buildSimulationRoute(route: RoutePreviewResponse): SimulationRoute {
  if (!Number.isFinite(route.durationSeconds) || route.durationSeconds <= 0
    || !Number.isFinite(route.distanceMeters) || route.distanceMeters <= 0
    || route.geometry.length < 2
    || route.geometry.some((p) => !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)
      || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180)
    || route.steps.some((s) => !Number.isFinite(s.distanceMeters) || s.distanceMeters < 0
      || !Number.isFinite(s.durationSeconds) || s.durationSeconds < 0)) {
    throw new Error('This route does not have enough valid data for simulation. Try another route.');
  }

  const geometry = route.geometry.map((point) => ({ ...point }));
  const geometryDistances = [0];
  for (let i = 1; i < geometry.length; i++) {
    geometryDistances.push(geometryDistances[i - 1] + distance(geometry[i - 1], geometry[i]));
  }
  const geometryLength = geometryDistances[geometryDistances.length - 1];
  if (geometryLength <= 0) {
    throw new Error('This route has no usable route line. Try another route.');
  }

  const movingSteps = route.steps
    .map((step, stepIndex) => ({ ...step, stepIndex }))
    .filter((step) => step.distanceMeters > 0 || step.durationSeconds > 0);
  if (movingSteps.length === 0) {
    movingSteps.push({
      instruction: 'Follow the route to your destination',
      roadName: '',
      maneuverType: 'continue',
      stepIndex: 0,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
    });
  }
  const summedDistance = movingSteps.reduce((sum, step) => sum + step.distanceMeters, 0);
  // A nonzero-distance, zero-duration step still needs a playback interval.
  const weights = movingSteps.map((step) => step.durationSeconds > 0
    ? step.durationSeconds
    : Math.max(0.001, route.durationSeconds * step.distanceMeters / (summedDistance || route.distanceMeters)));
  const summedTime = weights.reduce((sum, weight) => sum + weight, 0);
  let endSeconds = 0;
  let endMeters = 0;
  const segments = movingSteps.map((step, index) => {
    const startSeconds = endSeconds;
    const startMeters = endMeters;
    endSeconds += weights[index] / summedTime * route.durationSeconds;
    endMeters += (summedDistance > 0 ? step.distanceMeters / summedDistance : weights[index] / summedTime)
      * route.distanceMeters;
    if (index === movingSteps.length - 1) {
      endSeconds = route.durationSeconds;
      endMeters = route.distanceMeters;
    }
    return {
      instruction: step.instruction,
      stepIndex: step.stepIndex,
      startSeconds,
      endSeconds,
      startMeters,
      endMeters,
    };
  });
  return {
    durationSeconds: route.durationSeconds,
    distanceMeters: route.distanceMeters,
    stepCount: Math.max(1, route.steps.length),
    geometry,
    geometryDistances,
    geometryLength,
    segments,
    arrivalInstruction: route.steps.findLast((step) => step.maneuverType === 'arrive')?.instruction
      ?? 'You have arrived at your destination',
  };
}

export function simulationPositionAtDistance(model: SimulationRoute, traveledMeters: number): Coordinate {
  if (traveledMeters <= 0) return { ...model.geometry[0] };
  if (traveledMeters >= model.distanceMeters) return { ...model.geometry[model.geometry.length - 1] };
  const target = traveledMeters / model.distanceMeters * model.geometryLength;
  let low = 1;
  let high = model.geometryDistances.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (model.geometryDistances[mid] < target) low = mid + 1;
    else high = mid;
  }
  const before = model.geometry[low - 1];
  const after = model.geometry[low];
  const length = model.geometryDistances[low] - model.geometryDistances[low - 1];
  const fraction = length > 0 ? (target - model.geometryDistances[low - 1]) / length : 0;
  return {
    latitude: before.latitude + (after.latitude - before.latitude) * fraction,
    longitude: before.longitude + (after.longitude - before.longitude) * fraction,
  };
}

export function sampleSimulation(model: SimulationRoute, elapsedSeconds: number): SimulationSample {
  const elapsed = Number.isNaN(elapsedSeconds) ? 0 : Math.max(0, Math.min(model.durationSeconds, elapsedSeconds));
  const finished = elapsed >= model.durationSeconds;
  let index = model.segments.findIndex((segment) => elapsed < segment.endSeconds);
  if (index < 0) index = model.segments.length - 1;
  const segment = model.segments[index];
  const fraction = Math.min(1, Math.max(0,
    (elapsed - segment.startSeconds) / (segment.endSeconds - segment.startSeconds)));
  const traveledMeters = finished ? model.distanceMeters
    : segment.startMeters + fraction * (segment.endMeters - segment.startMeters);
  return {
    position: simulationPositionAtDistance(model, traveledMeters),
    instruction: finished ? model.arrivalInstruction : segment.instruction,
    nextInstruction: finished ? null : model.segments[index + 1]?.instruction ?? model.arrivalInstruction,
    stepIndex: finished ? model.stepCount - 1 : segment.stepIndex,
    distanceToNextMeters: finished ? 0 : Math.max(0, segment.endMeters - traveledMeters),
    traveledMeters,
    remainingMeters: Math.max(0, model.distanceMeters - traveledMeters),
    remainingSeconds: Math.max(0, model.durationSeconds - elapsed),
    progress: traveledMeters / model.distanceMeters,
    finished,
  };
}
