import type { Feature, FeatureCollection, Point } from 'geojson';
import type { CategorySearch, SearchBounds, SearchResult } from '../types';

export const CATEGORY_RESULT_LIMIT = 100;

const POSTPASS_ENDPOINT = 'https://postpass.geofabrik.de/api/interpreter';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_BOUNDS_AREA = 1;

export interface CategoryDefinition extends CategorySearch {
  key: string;
  value?: string;
  aliases: readonly string[];
}

export interface CategorySearchResponse {
  category: CategorySearch;
  results: SearchResult[];
  truncated: boolean;
}

const CATEGORIES: readonly CategoryDefinition[] = [
  { id: 'shops', label: 'Shops', key: 'shop', aliases: ['shop', 'shops', 'store', 'stores'] },
  { id: 'supermarkets', label: 'Supermarkets', key: 'shop', value: 'supermarket', aliases: ['supermarket', 'supermarkets'] },
  { id: 'convenience-stores', label: 'Convenience stores', key: 'shop', value: 'convenience', aliases: ['convenience store', 'convenience stores', 'corner shop', 'corner shops'] },
  { id: 'bakeries', label: 'Bakeries', key: 'shop', value: 'bakery', aliases: ['bakery', 'bakeries'] },
  { id: 'clothes-shops', label: 'Clothes shops', key: 'shop', value: 'clothes', aliases: ['clothes shop', 'clothes shops', 'clothing store', 'clothing stores'] },
  { id: 'bike-shops', label: 'Bike shops', key: 'shop', value: 'bicycle', aliases: ['bike shop', 'bike shops', 'bicycle shop', 'bicycle shops'] },
  { id: 'outdoor-shops', label: 'Outdoor shops', key: 'shop', value: 'outdoor', aliases: ['outdoor shop', 'outdoor shops', 'outdoor store', 'outdoor stores'] },
  { id: 'cafes', label: 'Cafes', key: 'amenity', value: 'cafe', aliases: ['cafe', 'cafes', 'coffee shop', 'coffee shops'] },
  { id: 'restaurants', label: 'Restaurants', key: 'amenity', value: 'restaurant', aliases: ['restaurant', 'restaurants'] },
  { id: 'pubs', label: 'Pubs', key: 'amenity', value: 'pub', aliases: ['pub', 'pubs'] },
  { id: 'bars', label: 'Bars', key: 'amenity', value: 'bar', aliases: ['bar', 'bars'] },
  { id: 'campsites', label: 'Campsites', key: 'tourism', value: 'camp_site', aliases: ['campsite', 'campsites', 'camp site', 'camp sites'] },
  { id: 'hotels', label: 'Hotels', key: 'tourism', value: 'hotel', aliases: ['hotel', 'hotels'] },
  { id: 'hostels', label: 'Hostels', key: 'tourism', value: 'hostel', aliases: ['hostel', 'hostels'] },
  { id: 'fuel', label: 'Fuel stations', key: 'amenity', value: 'fuel', aliases: ['fuel', 'fuel station', 'fuel stations', 'petrol station', 'petrol stations', 'gas station', 'gas stations'] },
  { id: 'drinking-water', label: 'Drinking water', key: 'amenity', value: 'drinking_water', aliases: ['drinking water', 'water tap', 'water taps'] },
  { id: 'viewpoints', label: 'Viewpoints', key: 'tourism', value: 'viewpoint', aliases: ['viewpoint', 'viewpoints', 'view point', 'view points'] },
];

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getCategoryForQuery(query: string): CategoryDefinition | undefined {
  const normalized = normalizeQuery(query);
  return CATEGORIES.find((category) => category.aliases.includes(normalized));
}

export function getCategoryById(id: string): CategoryDefinition | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

function validateBounds(bounds: SearchBounds) {
  const values = [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('Map bounds are unavailable. Move the map and try again.');
  }
  if (
    bounds.minLat < -90 || bounds.maxLat > 90 ||
    bounds.minLon < -180 || bounds.maxLon > 180 ||
    bounds.minLat >= bounds.maxLat || bounds.minLon >= bounds.maxLon
  ) {
    throw new Error('Move the map to a valid search area and try again.');
  }
  const area = (bounds.maxLat - bounds.minLat) * (bounds.maxLon - bounds.minLon);
  if (area > MAX_BOUNDS_AREA) {
    throw new Error('Zoom in to search this category.');
  }
}

export function buildPostpassQuery(
  category: CategorySearch,
  bounds: SearchBounds,
  limit = CATEGORY_RESULT_LIMIT,
): string {
  const definition = getCategoryById(category.id);
  if (!definition) throw new Error('This category is no longer supported.');
  if (!Number.isInteger(limit) || limit < 1 || limit > CATEGORY_RESULT_LIMIT) {
    throw new Error('Invalid category result limit.');
  }
  validateBounds(bounds);

  const tagFilter = definition.value
    ? `tags @> '${JSON.stringify({ [definition.key]: definition.value })}'::jsonb`
    : `tags ? '${definition.key}'`;
  const envelope = [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat]
    .map((value) => value.toFixed(6))
    .join(',');

  return [
    'SELECT osm_id, osm_type, tags, ST_Centroid(geom) AS geom',
    'FROM postpass_pointpolygon',
    `WHERE ${tagFilter}`,
    `AND geom && ST_MakeEnvelope(${envelope},4326)`,
    `LIMIT ${limit + 1}`,
  ].join('\n');
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

interface PostpassFeature {
  type?: unknown;
  geometry?: {
    type?: unknown;
    coordinates?: unknown;
  };
  properties?: {
    osm_id?: unknown;
    osm_type?: unknown;
    tags?: unknown;
  };
}

function normalizeFeature(feature: PostpassFeature, category: CategoryDefinition): SearchResult | null {
  if (feature.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) {
    return null;
  }
  const [lon, lat] = feature.geometry.coordinates;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || typeof lon !== 'number' || !Number.isFinite(lon)) {
    return null;
  }

  const tags: Record<string, string> = {};
  const rawTags = feature.properties?.tags;
  if (rawTags && typeof rawTags === 'object') {
    for (const [key, value] of Object.entries(rawTags)) {
      if (typeof value === 'string') tags[key] = value;
    }
  }

  const categoryValue = tags[category.key] ?? category.value ?? category.id;
  const type = humanize(categoryValue);
  const name = tags.name?.trim() || `Unnamed ${type.toLowerCase()}`;
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const locality = tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'];
  const detail = [street, locality, tags['addr:postcode']].filter(Boolean).join(', ');
  const osmType = typeof feature.properties?.osm_type === 'string' ? feature.properties.osm_type : '';
  const rawId = feature.properties?.osm_id;
  const osmId = typeof rawId === 'number' || typeof rawId === 'string' ? rawId : '';

  return {
    id: osmType === '' || osmId === '' ? undefined : `${osmType}/${osmId}`,
    displayName: detail ? `${name}, ${detail}` : name,
    name,
    detail: detail || undefined,
    lat,
    lon,
    type,
    importance: 0,
    tags,
  };
}

export async function searchCategory(
  category: CategorySearch,
  bounds: SearchBounds,
  signal?: AbortSignal,
): Promise<CategorySearchResponse> {
  const definition = getCategoryById(category.id);
  if (!definition) throw new Error('This category is no longer supported.');
  const query = buildPostpassQuery(definition, bounds);
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(POSTPASS_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/geo+json, application/json' },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Postpass category search is busy. Please try again shortly.');
      }
      if (response.status >= 500) {
        throw new Error(`Postpass category search is unavailable right now (${response.status}). Try again shortly.`);
      }
      throw new Error(`Postpass category search failed (${response.status}).`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Postpass category search returned an invalid response.');
    }
    if (!body || typeof body !== 'object' || !Array.isArray((body as { features?: unknown }).features)) {
      throw new Error('Postpass category search returned an invalid response.');
    }

    const features = (body as { features: PostpassFeature[] }).features;
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLon = (bounds.minLon + bounds.maxLon) / 2;
    const results = features
      .map((feature) => normalizeFeature(feature, definition))
      .filter((result): result is SearchResult => result !== null)
      .sort((a, b) => {
        const aDistance = (a.lat - centerLat) ** 2 + (a.lon - centerLon) ** 2;
        const bDistance = (b.lat - centerLat) ** 2 + (b.lon - centerLon) ** 2;
        return aDistance - bDistance || a.displayName.localeCompare(b.displayName);
      })
      .slice(0, CATEGORY_RESULT_LIMIT);

    return {
      category: { id: definition.id, label: definition.label },
      results,
      truncated: features.length > CATEGORY_RESULT_LIMIT,
    };
  } catch (error) {
    if (timedOut) throw new Error('Postpass category search took too long. Zoom in or try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export function categoryResultsToGeoJSON(results: SearchResult[]): FeatureCollection {
  const features: Feature<Point>[] = results.map((result) => ({
    type: 'Feature',
    id: result.id,
    properties: {
      ...result.tags,
      name: result.name ?? result.displayName,
      description: result.detail ?? result.type,
      type: result.type,
    },
    geometry: {
      type: 'Point',
      coordinates: [result.lon, result.lat],
    },
  }));

  return { type: 'FeatureCollection', features };
}
