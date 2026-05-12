import * as turf from "@turf/turf";
import { Breach, Telemetry, Zone } from "./types";

type GeoPolygon = ReturnType<typeof turf.polygon>;

const polygonCache = new WeakMap<Zone["polygon"], GeoPolygon>();

function toGeoJsonPolygon(zone: Zone): GeoPolygon {
  const cached = polygonCache.get(zone.polygon);
  if (cached) return cached;

  const ring = zone.polygon.map(([lat, lng]) => [lng, lat]);
  if (ring.length > 0) {
    const [fLng, fLat] = ring[0];
    const [lLng, lLat] = ring[ring.length - 1];
    if (fLng !== lLng || fLat !== lLat) ring.push([fLng, fLat]);
  }
  const poly = turf.polygon([ring]);
  polygonCache.set(zone.polygon, poly);
  return poly;
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function detectBreach(loc: Telemetry, zones: Zone[]): Breach | null {
  if (!zones.length) return null;
  const pt = turf.point([loc.lng, loc.lat]);

  for (const z of zones) {
    if (z.type !== "restricted" || z.polygon.length < 3) continue;
    if (turf.booleanPointInPolygon(pt, toGeoJsonPolygon(z))) {
      return { zoneId: z.id, zoneName: z.name, reason: "inside-restricted" };
    }
  }

  const allowed = zones.filter((z) => z.type === "allowed" && z.polygon.length >= 3);
  if (allowed.length > 0) {
    const insideAny = allowed.some((z) =>
      turf.booleanPointInPolygon(pt, toGeoJsonPolygon(z))
    );
    if (!insideAny) {
      return { zoneId: null, zoneName: "any allowed zone", reason: "outside-allowed" };
    }
  }

  return null;
}
