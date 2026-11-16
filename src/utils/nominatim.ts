import type { SearchResult, SearchBounds } from '../types';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/**
 * Search for places using the Nominatim API.
 * Accepts a free-form query string and returns top results.
 *
 * @param bounds  Optional bounding box to restrict results to the visible map area.
 *                When provided, uses viewbox + bounded=1 to prioritise / limit results.
 */
export async function searchPlaces(
  query: string,
  bounds?: SearchBounds,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '10',
    addressdetails: '1',
  });

  // Restrict results to the current map viewport when bounds are available
  if (bounds) {
    // Nominatim expects viewbox as: left,top,right,bottom (minLon,maxLat,maxLon,minLat)
    params.set('viewbox', `${bounds.minLon},${bounds.maxLat},${bounds.maxLon},${bounds.minLat}`);
    params.set('bounded', '1');
  }

  const url = `${NOMINATIM_BASE}/search?${params}`;

  // Browser requests identify the application with their HTTP Referer.
  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`Nominatim search failed (${res.status})`);
  }

  const body = await res.json();
  if (!Array.isArray(body)) return [];

  return body.map((item: any) => ({
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    type: item.type ?? 'unknown',
    importance: item.importance ?? 0,
  }));
}
