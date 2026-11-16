import type { GeoJSON } from 'geojson';

// ─── Layer Types ───────────────────────────────────────────────────

export interface CategorySearch {
  /** Stable id from the category registry */
  id: string;
  /** User-visible category name */
  label: string;
}

export interface CategoryLayerSearch extends CategorySearch {
  /** Viewport used for the last successful category query */
  bounds?: SearchBounds;
}

export interface MapLayer {
  /** Unique id for this layer instance */
  id: string;
  /** User-visible name (editable) */
  name: string;
  /** Whether the layer is currently shown on the map */
  visible: boolean;
  /** The GeoJSON data for this layer (null while loading or empty) */
  data: GeoJSON | null;
  /** Styling overrides applied to this layer */
  style?: LayerStyle;
  /** Category query that can be rerun in the current viewport */
  categorySearch?: CategoryLayerSearch;
  /** When this layer was created / last updated */
  updatedAt: number;
}

export interface LayerStyle {
  color?: string;
  weight?: number;
  opacity?: number;
  fillColor?: string;
  fillOpacity?: number;
}

// ─── Search Types ──────────────────────────────────────────────────

export interface SearchResult {
  id?: string;
  displayName: string;
  name?: string;
  detail?: string;
  lat: number;
  lon: number;
  type: string;
  importance: number;
  tags?: Record<string, string>;
}

/** Bounding box for viewport-restricted searches (SW corner → NE corner) */
export interface SearchBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

// ─── Route Types ───────────────────────────────────────────────────

export interface RouteWaypoint {
  lat: number;
  lon: number;
  label?: string;
}

export interface RouteInfo {
  distance: number;   // metres
  duration: number;   // seconds
  geometry: GeoJSON;
}

// ─── App State ─────────────────────────────────────────────────────

export type RouteProfile = 'driving' | 'walking' | 'cycling';

export type ModalMode = 'add-geojson' | 'add-route' | 'search' | null;

export type ViewTarget =
  | { type: 'center'; center: [number, number]; zoom?: number }
  | { type: 'bounds'; bounds: [[number, number], [number, number]]; padding?: [number, number] };

export interface AppState {
  layers: MapLayer[];
}
