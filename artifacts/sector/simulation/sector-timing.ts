import { simulationPositionAtDistance } from './route-simulation.ts';
import type { SimulationRoute } from './route-simulation';

export const PRACTICE_SECTOR_COUNTS = [2, 3, 4, 5] as const;
export type PracticeSectorCount = (typeof PRACTICE_SECTOR_COUNTS)[number];

export type SimulationSector = {
  id: number;
  startMeters: number;
  endMeters: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  endPosition: { latitude: number; longitude: number };
};

export type SimulationSectorSplit = SimulationSector & {
  status: 'pending' | 'active' | 'complete';
  splitSeconds: number;
  cumulativeSeconds: number | null;
};

/**
 * Exact estimated crossing time, not a timer tick. This is the inverse of the
 * playback model, including any stationary intervals before a boundary.
 * An exact internal boundary belongs to the preceding sector at its first
 * crossing; trailing stationary time is included in the final sector.
 */
function secondsAtDistance(model: SimulationRoute, meters: number): number {
  if (meters <= 0) return 0;
  if (meters >= model.distanceMeters) return model.durationSeconds;
  for (const segment of model.segments) {
    if (segment.endMeters < meters || segment.endMeters === segment.startMeters) continue;
    const fraction = (meters - segment.startMeters) / (segment.endMeters - segment.startMeters);
    return segment.startSeconds + fraction * (segment.endSeconds - segment.startSeconds);
  }
  return model.durationSeconds;
}

/** Equal-distance practice sectors; not road segments, GPS gates or speed targets. */
export function buildSimulationSectors(model: SimulationRoute, count = 3): SimulationSector[] {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('Choose between 1 and 20 simulated sectors.');
  }
  return Array.from({ length: count }, (_, index) => {
    const startMeters = model.distanceMeters * index / count;
    const endMeters = index === count - 1 ? model.distanceMeters : model.distanceMeters * (index + 1) / count;
    const startSeconds = secondsAtDistance(model, startMeters);
    const endSeconds = secondsAtDistance(model, endMeters);
    return {
      id: index + 1,
      startMeters,
      endMeters,
      startSeconds,
      endSeconds,
      durationSeconds: endSeconds - startSeconds,
      endPosition: simulationPositionAtDistance(model, endMeters),
    };
  });
}

export function sampleSectorSplits(
  sectors: SimulationSector[],
  elapsedSeconds: number,
): SimulationSectorSplit[] {
  const duration = sectors.at(-1)?.endSeconds ?? 0;
  const elapsed = Number.isNaN(elapsedSeconds) ? 0 : Math.max(0, Math.min(duration, elapsedSeconds));
  return sectors.map((sector) => {
    const complete = elapsed >= sector.endSeconds;
    const pending = !complete && elapsed < sector.startSeconds;
    return {
      ...sector,
      status: complete ? 'complete' : pending ? 'pending' : 'active',
      splitSeconds: complete ? sector.durationSeconds
        : pending ? 0 : Math.max(0, elapsed - sector.startSeconds),
      cumulativeSeconds: complete ? sector.endSeconds : null,
    };
  });
}
