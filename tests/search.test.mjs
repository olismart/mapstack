import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let getCategoryForQuery;
let buildPostpassQuery;
let searchCategory;
let categoryResultsToGeoJSON;
let classifyWaypoint;
let haveSearchBoundsChanged;

const BOUNDS = { minLon: -0.13, minLat: 51.5, maxLon: -0.12, maxLat: 51.51 };
const SHOPS = { id: 'shops', label: 'Shops' };

before(async () => {
  vite = await createServer({
    configFile: false,
    cacheDir: 'node_modules/.vite-tests/search',
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  ({
    getCategoryForQuery,
    buildPostpassQuery,
    searchCategory,
    categoryResultsToGeoJSON,
  } = await vite.ssrLoadModule('/src/utils/postpass.ts'));
  ({ classifyWaypoint } = await vite.ssrLoadModule('/src/utils/waypointMarkers.ts'));
  ({ haveSearchBoundsChanged } = await vite.ssrLoadModule('/src/utils/bounds.ts'));
});

after(async () => {
  await vite.close();
});

test('recognizes category aliases without capturing ordinary place names', () => {
  assert.equal(getCategoryForQuery('  Shops ').id, 'shops');
  assert.equal(getCategoryForQuery('bike shops').id, 'bike-shops');
  assert.equal(getCategoryForQuery('COFFEE   SHOPS').id, 'cafes');
  assert.equal(getCategoryForQuery('Tesco, Bristol'), undefined);
});

test('builds an indexed Postpass query with an extra result for truncation detection', () => {
  const query = buildPostpassQuery(SHOPS, BOUNDS);
  assert.equal(
    query,
    [
      'SELECT osm_id, osm_type, tags, ST_Centroid(geom) AS geom',
      'FROM postpass_pointpolygon',
      "WHERE tags ? 'shop'",
      'AND geom && ST_MakeEnvelope(-0.130000,51.500000,-0.120000,51.510000,4326)',
      'LIMIT 101',
    ].join('\n'),
  );
  const cafes = getCategoryForQuery('cafes');
  const cafeQuery = buildPostpassQuery(cafes, BOUNDS, 50);
  assert.match(cafeQuery, /tags @> '\{"amenity":"cafe"\}'::jsonb/);
  assert.match(cafeQuery, /LIMIT 51/);
});

test('rejects excessive viewport queries and invalid limits', () => {
  assert.throws(
    () => buildPostpassQuery(SHOPS, { minLon: -180, minLat: -90, maxLon: 180, maxLat: 90 }),
    /Zoom in/,
  );
  assert.throws(() => buildPostpassQuery(SHOPS, BOUNDS, 101), /result limit/);
});

test('normalizes Postpass GeoJSON, caps results, and posts the query', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  let requestedBody;
  const features = Array.from({ length: 105 }, (_, index) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [-0.13 + index / 100000, 51.5 + index / 100000],
    },
    properties: {
      osm_type: index === 52 ? 'W' : 'N',
      osm_id: index + 1,
      tags: { shop: 'convenience', name: `Shop ${index}` },
    },
  }));

  try {
    globalThis.fetch = async (url, options) => {
      requestedUrl = url;
      requestedBody = options.body;
      return { ok: true, json: async () => ({ type: 'FeatureCollection', features }) };
    };
    const response = await searchCategory(SHOPS, BOUNDS);
    assert.equal(requestedUrl, 'https://postpass.geofabrik.de/api/interpreter');
    assert.match(requestedBody.get('data'), /LIMIT 101/);
    assert.equal(response.results.length, 100);
    assert.equal(response.truncated, true);
    const wayResult = response.results.find((result) => result.id === 'W/53');
    assert.equal(wayResult.lat, 51.5 + 52 / 100000);
    assert.equal(wayResult.lon, -0.13 + 52 / 100000);
    assert.equal(wayResult.type, 'convenience');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('keeps OSM tags, ignores invalid geometry, and classifies markers', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-0.12, 51.5] },
            properties: { osm_type: 'N', osm_id: 1, tags: { shop: 'supermarket', name: 'Tesco' } },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-0.13, 51.51] },
            properties: { osm_type: 'R', osm_id: 2, tags: { shop: 'bakery' } },
          },
          {
            type: 'Feature',
            geometry: { type: 'MultiPolygon', coordinates: [] },
            properties: { osm_type: 'W', osm_id: 3, tags: { shop: 'books' } },
          },
        ],
      }),
    });
    const { results } = await searchCategory(SHOPS, BOUNDS);
    const data = categoryResultsToGeoJSON(results);
    assert.equal(data.features.length, 2);
    assert.equal(data.features[0].properties.name, 'Tesco');
    assert.equal(data.features[0].properties.shop, 'supermarket');
    assert.equal(data.features[1].id, 'R/2');
    assert.equal(data.features[1].properties.name, 'Unnamed bakery');
    assert.equal(classifyWaypoint(data.features[0].properties).category, 'shop');
    assert.equal(classifyWaypoint({ amenity: 'cafe' }).category, 'cafe');
    assert.equal(classifyWaypoint({ tourism: 'camp_site' }).category, 'camp');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('enables refresh only after the saved viewport changes', () => {
  assert.equal(haveSearchBoundsChanged(BOUNDS, { ...BOUNDS }), false);
  assert.equal(haveSearchBoundsChanged(BOUNDS, { ...BOUNDS, minLon: BOUNDS.minLon + 0.0000005 }), false);
  assert.equal(haveSearchBoundsChanged(BOUNDS, { ...BOUNDS, minLon: BOUNDS.minLon + 0.01 }), true);
  assert.equal(haveSearchBoundsChanged(BOUNDS, { ...BOUNDS, maxLat: BOUNDS.maxLat + 0.01 }), true);
  assert.equal(haveSearchBoundsChanged(undefined, BOUNDS), false);
  assert.equal(haveSearchBoundsChanged(BOUNDS, null), false);
});

test('surfaces upstream errors without returning partial data', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(searchCategory(SHOPS, BOUNDS), /busy/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
