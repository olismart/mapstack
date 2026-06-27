import type { SearchResult } from '../types';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/**
 * Search for places using the Nominatim API.
 * Accepts a free-form query string and returns top results.
 */
export async function searchPlaces(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '10',
    addressdetails: '1',
  });

  const url = `${NOMINATIM_BASE}/search?${params}`;

  const res = await fetch(url, {
    headers: {
      // Nominatim requires a User-Agent
      'User-Agent': 'Mapstack/0.1 (learning project)',
    },
  });

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
