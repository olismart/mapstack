import type { RouteWaypoint, RouteInfo } from '../types';

const OSRM_BASE = 'https://router.project-osrm.org';

/**
 * Fetch a driving route between waypoints from the public OSRM demo server.
 * Returns a polyline geometry + distance / duration.
 */
export async function getRoute(
  waypoints: RouteWaypoint[],
): Promise<RouteInfo> {
  if (waypoints.length < 2) {
    throw new Error('Need at least two waypoints');
  }

  const coords = waypoints
    .map((w) => `${w.lon.toFixed(6)},${w.lat.toFixed(6)}`)
    .join(';');

  const url = `${OSRM_BASE}/route/v1/driving/${coords}?geometries=geojson&overview=full`;

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
