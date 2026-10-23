import { Router, type IRouter } from "express";
import {
  GetRoutePreviewBody,
  GetRoutePreviewResponse,
  SearchPlacesBody,
  SearchPlacesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const MAPBOX_BASE_URL = "https://api.mapbox.com";
const REQUEST_TIMEOUT_MS = 12_000;

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null ? value as JsonObject : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

router.post("/places/search", async (req, res) => {
  const input = SearchPlacesBody.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Enter a place name or address (at least 3 characters)." });
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return res.status(503).json({ error: "Destination search is not configured yet." });

  const url = new URL("/search/searchbox/v1/forward", MAPBOX_BASE_URL);
  url.searchParams.set("q", input.data.query.trim().slice(0, 256));
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", "5");
  url.searchParams.set("access_token", token);

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!upstream.ok) {
      req.log.warn({ upstreamStatus: upstream.status }, "Mapbox place search returned an error");
      return res.status(502).json({ error: "Destination search is temporarily unavailable. Please try again." });
    }

    const payload: unknown = await upstream.json();
    const features = object(payload)?.features;
    const results = Array.isArray(features) ? features.flatMap((feature) => {
      const item = object(feature);
      const properties = object(item?.properties);
      const coordinates = object(item?.geometry)?.coordinates;
      if (!properties || !Array.isArray(coordinates)) return [];
      const longitude = numberValue(coordinates[0]);
      const latitude = numberValue(coordinates[1]);
      const name = stringValue(properties.name) ?? stringValue(properties.name_preferred) ?? stringValue(properties.full_address);
      if (longitude === undefined || latitude === undefined || !name) return [];
      return [{
        id: stringValue(properties.mapbox_id) ?? stringValue(item?.id) ?? `${longitude},${latitude}`,
        name,
        fullAddress: stringValue(properties.full_address) ?? stringValue(properties.place_formatted) ?? name,
        featureType: stringValue(properties.feature_type) ?? "place",
        longitude,
        latitude,
      }];
    }) : [];

    const response = SearchPlacesResponse.parse({
      results,
      attribution: stringValue(object(payload)?.attribution) ?? "© Mapbox",
    });
    res.setHeader("Cache-Control", "no-store");
    return res.json(response);
  } catch (error) {
    req.log.warn({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Mapbox place search failed");
    return res.status(502).json({ error: "Destination search is temporarily unavailable. Please try again." });
  }
});

router.post("/route/preview", async (req, res) => {
  const input = GetRoutePreviewBody.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Location coordinates are invalid." });
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return res.status(503).json({ error: "Route preview is not configured yet." });

  const { origin, destination } = input.data;
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = new URL(`/directions/v5/mapbox/driving-traffic/${coords}`, MAPBOX_BASE_URL);
  url.searchParams.set("access_token", token);
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("steps", "true");
  url.searchParams.set("language", "en");

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!upstream.ok) {
      req.log.warn({ upstreamStatus: upstream.status }, "Mapbox directions returned an error");
      return res.status(502).json({ error: "Route preview is temporarily unavailable. Please try again." });
    }

    const payload = object(await upstream.json());
    const routes = payload?.routes;
    if (!Array.isArray(routes) || !routes.length) {
      return res.status(404).json({ error: "No driving route was found for those locations." });
    }
    const route = object(routes[0]);
    const coordinates = object(route?.geometry)?.coordinates;
    const legs = route?.legs;
    if (!route || !Array.isArray(coordinates) || !Array.isArray(legs)) {
      req.log.warn({}, "Mapbox directions returned an unexpected response");
      return res.status(502).json({ error: "Route preview is temporarily unavailable. Please try again." });
    }

    const geometry = coordinates.flatMap((pair) => {
      if (!Array.isArray(pair)) return [];
      const longitude = numberValue(pair[0]);
      const latitude = numberValue(pair[1]);
      return longitude === undefined || latitude === undefined ? [] : [{ longitude, latitude }];
    });
    const steps = legs.flatMap((leg) => {
      const rawSteps = object(leg)?.steps;
      if (!Array.isArray(rawSteps)) return [];
      return rawSteps.flatMap((rawStep) => {
        const step = object(rawStep);
        const maneuver = object(step?.maneuver);
        const instruction = stringValue(maneuver?.instruction);
        const distanceMeters = numberValue(step?.distance);
        const durationSeconds = numberValue(step?.duration);
        if (!instruction || distanceMeters === undefined || durationSeconds === undefined) return [];
        return [{
          instruction,
          roadName: stringValue(step?.name) ?? "",
          distanceMeters,
          durationSeconds,
          maneuverType: stringValue(maneuver?.type) ?? "continue",
        }];
      });
    });

    const response = GetRoutePreviewResponse.parse({
      distanceMeters: numberValue(route.distance),
      durationSeconds: numberValue(route.duration),
      geometry,
      steps,
      attribution: "© Mapbox",
    });
    res.setHeader("Cache-Control", "no-store");
    return res.json(response);
  } catch (error) {
    req.log.warn({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Mapbox route preview failed");
    return res.status(502).json({ error: "Route preview is temporarily unavailable. Please try again." });
  }
});

export default router;
