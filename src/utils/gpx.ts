import type { Feature, FeatureCollection, LineString, Point, Position } from 'geojson';

export interface ParsedGPXResult {
  geojson: FeatureCollection;
  name: string;
  distance: number; // in meters
  duration: number; // in seconds
}

/**
 * Calculates great-circle distance between two coordinates in meters (Haversine formula).
 */
function haversineDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if a string looks like GPX / XML content.
 */
export function isGPXContent(text: string): boolean {
  const trimmed = text.trim();
  return (
    (trimmed.startsWith('<') && trimmed.includes('<gpx')) ||
    trimmed.includes('<trk') ||
    trimmed.includes('<rte') ||
    trimmed.includes('<wpt')
  );
}

/**
 * Parses GPX XML text into a GeoJSON FeatureCollection with distance and duration metrics.
 */
export function parseGPX(xmlText: string, fallbackName = 'Imported Route'): ParsedGPXResult {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');

  const parserError = xml.querySelector('parsererror');
  if (parserError) {
    throw new Error(`Invalid XML/GPX format: ${parserError.textContent?.slice(0, 100) || 'Parse error'}`);
  }

  let routeName =
    xml.querySelector('metadata > name')?.textContent?.trim() ||
    xml.querySelector('trk > name')?.textContent?.trim() ||
    xml.querySelector('rte > name')?.textContent?.trim() ||
    fallbackName;

  const features: Feature[] = [];
  let totalDistance = 0;
  let minTimestamp: number | null = null;
  let maxTimestamp: number | null = null;

  // Process tracks (<trk>)
  const tracks = xml.querySelectorAll('trk');
  tracks.forEach((trk) => {
    const trkName = trk.querySelector('name')?.textContent?.trim() || routeName;
    const trksegs = trk.querySelectorAll('trkseg');

    trksegs.forEach((seg) => {
      const coords: Position[] = [];
      const trkpts = seg.querySelectorAll('trkpt');
      let prevCoord: [number, number] | null = null;

      trkpts.forEach((pt) => {
        const lat = parseFloat(pt.getAttribute('lat') || '');
        const lon = parseFloat(pt.getAttribute('lon') || '');
        if (isNaN(lat) || isNaN(lon)) return;

        const eleNode = pt.querySelector('ele');
        const ele = eleNode ? parseFloat(eleNode.textContent || '') : null;

        const timeNode = pt.querySelector('time');
        if (timeNode?.textContent) {
          const t = new Date(timeNode.textContent).getTime();
          if (!isNaN(t)) {
            if (minTimestamp === null || t < minTimestamp) minTimestamp = t;
            if (maxTimestamp === null || t > maxTimestamp) maxTimestamp = t;
          }
        }

        const coord: Position = !isNaN(Number(ele)) && ele !== null ? [lon, lat, ele] : [lon, lat];
        coords.push(coord);

        if (prevCoord) {
          totalDistance += haversineDistance(prevCoord[0], prevCoord[1], lon, lat);
        }
        prevCoord = [lon, lat];
      });

      if (coords.length > 1) {
        features.push({
          type: 'Feature',
          properties: { name: trkName, type: 'track' },
          geometry: { type: 'LineString', coordinates: coords },
        });
      }
    });
  });

  // Process routes (<rte>)
  const routes = xml.querySelectorAll('rte');
  routes.forEach((rte) => {
    const rName = rte.querySelector('name')?.textContent?.trim() || routeName;
    const coords: Position[] = [];
    const rtepts = rte.querySelectorAll('rtept');
    let prevCoord: [number, number] | null = null;

    rtepts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute('lat') || '');
      const lon = parseFloat(pt.getAttribute('lon') || '');
      if (isNaN(lat) || isNaN(lon)) return;

      const eleNode = pt.querySelector('ele');
      const ele = eleNode ? parseFloat(eleNode.textContent || '') : null;

      const coord: Position = !isNaN(Number(ele)) && ele !== null ? [lon, lat, ele] : [lon, lat];
      coords.push(coord);

      if (prevCoord) {
        totalDistance += haversineDistance(prevCoord[0], prevCoord[1], lon, lat);
      }
      prevCoord = [lon, lat];
    });

    if (coords.length > 1) {
      features.push({
        type: 'Feature',
        properties: { name: rName, type: 'route' },
        geometry: { type: 'LineString', coordinates: coords },
      });
    }
  });

  // Process waypoints (<wpt>)
  const waypoints = xml.querySelectorAll('wpt');
  waypoints.forEach((wpt) => {
    const lat = parseFloat(wpt.getAttribute('lat') || '');
    const lon = parseFloat(wpt.getAttribute('lon') || '');
    if (isNaN(lat) || isNaN(lon)) return;

    const wptName = wpt.querySelector('name')?.textContent?.trim() || 'Waypoint';
    const desc = wpt.querySelector('desc')?.textContent?.trim() || wpt.querySelector('cmt')?.textContent?.trim();
    const sym = wpt.querySelector('sym')?.textContent?.trim() || wpt.querySelector('type')?.textContent?.trim();

    features.push({
      type: 'Feature',
      properties: {
        name: wptName,
        description: desc,
        note: desc,
        sym,
        type: 'waypoint',
      },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    });
  });

  if (features.length === 0) {
    throw new Error('No valid tracks, routes, or waypoints found in GPX file');
  }

  const duration =
    minTimestamp !== null && maxTimestamp !== null && maxTimestamp > minTimestamp
      ? Math.round((maxTimestamp - minTimestamp) / 1000)
      : 0;

  return {
    geojson: { type: 'FeatureCollection', features },
    name: routeName,
    distance: Math.round(totalDistance),
    duration,
  };
}
