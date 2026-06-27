import type { GeoJSON } from 'geojson';

// ─── Layer Types ───────────────────────────────────────────────────

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
  displayName: string;
  lat: number;
  lon: number;
  type: string;
  importance: number;
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

export type ModalMode = 'add-geojson' | 'add-route' | 'search' | null;

export interface AppState {
  layers: MapLayer[];
}
