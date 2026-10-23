import type { SimulationRoute } from './route-simulation';
import { buildSimulationSectors, simulationSecondsAtDistance } from './sector-timing.ts';

export const SIMULATED_STOP_DURATIONS = [0, 10, 30, 60, 120] as const;
export type SimulatedStopDuration = (typeof SIMULATED_STOP_DURATIONS)[number];
export type SimulatedStopConfig = { sectorId: number; durationSeconds: SimulatedStopDuration };
export type SimulatedStop = {
  sectorId: number;
  meters: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

/** Inserts a synthetic hold midway through a sector, leaving the Mapbox model untouched. */
export function configureSimulatedStop(
  reference: SimulationRoute,
  sectorCount: number,
  config: SimulatedStopConfig,
): { model: SimulationRoute; stop: SimulatedStop | null } {
  const sectors = buildSimulationSectors(reference, sectorCount);
  if (!Number.isInteger(config.sectorId) || config.sectorId < 1 || config.sectorId > sectors.length
    || !SIMULATED_STOP_DURATIONS.includes(config.durationSeconds)) {
    throw new Error('Choose a valid practice sector and a supported simulated stop duration.');
  }
  if (config.durationSeconds === 0) return { model: reference, stop: null };
  const sector = sectors[config.sectorId - 1];
  const meters = (sector.startMeters + sector.endMeters) / 2;
  const startSeconds = simulationSecondsAtDistance(reference, meters);
  const stop: SimulatedStop = {
    sectorId: config.sectorId,
    meters,
    startSeconds,
    endSeconds: startSeconds + config.durationSeconds,
    durationSeconds: config.durationSeconds,
  };
  const index = reference.segments.findIndex((segment) =>
    segment.endMeters >= meters && segment.startMeters <= meters && segment.endMeters > segment.startMeters);
  if (index < 0) throw new Error('This route has no moving segment at the configured simulated stop.');
  const current = reference.segments[index];
  const segments: SimulationRoute['segments'] = [];
  reference.segments.forEach((segment, i) => {
    if (i < index) {
      segments.push({ ...segment });
    } else if (i > index) {
      segments.push({
        ...segment,
        startSeconds: segment.startSeconds + stop.durationSeconds,
        endSeconds: segment.endSeconds + stop.durationSeconds,
      });
    } else {
      if (startSeconds > current.startSeconds) {
        segments.push({ ...current, endSeconds: startSeconds, endMeters: meters });
      }
      segments.push({
        ...current,
        instruction: `Configured simulated stop in S${stop.sectorId}`,
        startMeters: meters,
        endMeters: meters,
        startSeconds: stop.startSeconds,
        endSeconds: stop.endSeconds,
      });
      if (startSeconds < current.endSeconds) {
        segments.push({
          ...current,
          startSeconds: stop.endSeconds,
          endSeconds: current.endSeconds + stop.durationSeconds,
          startMeters: meters,
        });
      }
    }
  });
  return {
    model: { ...reference, durationSeconds: reference.durationSeconds + stop.durationSeconds, segments },
    stop,
  };
}

export function sampleSimulatedStop(stop: SimulatedStop | null, elapsedSeconds: number) {
  if (!stop) return { phase: 'disabled' as const, elapsedSeconds: 0, remainingSeconds: 0 };
  const elapsed = Number.isNaN(elapsedSeconds) ? 0 : elapsedSeconds;
  const consumed = Math.max(0, Math.min(stop.durationSeconds, elapsed - stop.startSeconds));
  return {
    phase: elapsed < stop.startSeconds ? 'upcoming' as const
      : elapsed < stop.endSeconds ? 'holding' as const : 'passed' as const,
    elapsedSeconds: consumed,
    remainingSeconds: stop.durationSeconds - consumed,
  };
}
