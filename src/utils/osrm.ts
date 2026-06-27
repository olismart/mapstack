import type { RouteWaypoint, RouteInfo, RouteProfile } from '../types';

/**
 * Public OSRM servers from OpenStreetMap Deutschland.
 * Each subdomain runs a different transport profile.
 */
const PROFILE_BASE: Record<RouteProfile, string> = {
  driving: 'https://routing.openstreetmap.de/routed-car',
  walking: 'https://routing.openstreetmap.de/routed-foot',
  cycling: 'https://routing.openstreetmap.de/routed-bike',
};

/**
 * Fetch a route between waypoints from a public OSRM server.
 * Returns a polyline geometry + distance / duration.
 * Uses separate servers per profile so walking/cycling avoid highways.
 */
export async function getRoute(
  waypoints: RouteWaypoint[],
  profile: RouteProfile = 'driving',
): Promise<RouteInfo> {
  if (waypoints.length < 2) {
    throw new Error('Need at least two waypoints');
  }

  const base = PROFILE_BASE[profile];
  const coords = waypoints
    .map((w) => `${w.lon.toFixed(6)},${w.lat.toFixed(6)}`)
    .join(';');

  // The server instance already selects the transport mode, so the
  // URL path profile is always 'driving' (the OSRM default).
  const url = `${base}/route/v1/driving/${coords}?geometries=geojson&overview=full`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM request failed (${res.status})`);
  }

  const body = await res.json();
  if (!body.routes?.length) {
    throw new Error('No route found');
  }

  const route = body.routes[0];

  return {
    distance: route.distance,
    duration: route.duration,
    geometry: {
      type: 'Feature',
      properties: {},
      geometry: route.geometry,
    },
  };
}
