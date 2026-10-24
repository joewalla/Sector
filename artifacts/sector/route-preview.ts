import { z } from 'zod';
import type { RoutePreviewResponse } from '@workspace/api-client-react';
import { buildSimulationRoute } from './simulation/route-simulation';

const nonnegativeMetric = z.number().finite().nonnegative();
const routePreviewSchema = z.object({
  distanceMeters: z.number().finite().positive(),
  durationSeconds: z.number().finite().positive(),
  attribution: z.string(),
  geometry: z.array(z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })).min(2),
  steps: z.array(z.object({
    instruction: z.string().refine((value) => value.trim().length > 0, 'Missing route instruction'),
    roadName: z.string(),
    maneuverType: z.string(),
    distanceMeters: nonnegativeMetric,
    durationSeconds: nonnegativeMetric,
  })).min(1).refine(
    (steps) => steps.some((step) => step.distanceMeters > 0 || step.durationSeconds > 0),
    'No usable movement instructions',
  ),
});

/** Generated client types are not runtime validation of an untrusted response. */
export function parseRoutePreview(payload: unknown): RoutePreviewResponse {
  const route = routePreviewSchema.parse(payload);
  // Reuse the simulation's geometry/timeline checks before exposing any route UI.
  // In particular, two valid but coincident coordinates are not a usable shape.
  buildSimulationRoute(route);
  return route;
}
