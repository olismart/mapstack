import { useEffect, useRef, useMemo } from 'react';
import type { Map as LeafletMap, Layer as LeafletLayer } from 'leaflet';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { GeoJSON as GeoJSONType, Feature } from 'geojson';
import type { MapLayer, LayerStyle, ViewTarget } from '../types';

// ─── Default map centre (London) ──────────────────────────────────
const DEFAULT_CENTER: [number, number] = [51.5074, -0.1278];
const DEFAULT_ZOOM = 10;

// ─── Sub-component to handle map viewport changes ─────────────────
function MapViewportController({ target }: { target?: ViewTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;

    if (target.type === 'bounds') {
      map.fitBounds(target.bounds, {
        padding: target.padding ?? [50, 50],
        maxZoom: 16,
        animate: true,
        duration: 1,
      });
    } else if (target.type === 'center') {
      map.flyTo(target.center, target.zoom ?? map.getZoom(), { duration: 1 });
    }
  }, [target, map]);
  return null;
}

// ─── Sub-component to expose map instance to parent ───────────────
function MapEventHandler({ onMapReady }: { onMapReady: (map: LeafletMap) => void }) {
  useMapEvents({
    moveend: () => {},
  });
  const map = useMap();
  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);
  return null;
}

// ─── Style function for GeoJSON layers ────────────────────────────
function makeStyle(style?: LayerStyle): any {
  return {
    color: style?.color ?? '#3388ff',
    weight: style?.weight ?? 3,
    opacity: style?.opacity ?? 0.8,
    fillColor: style?.fillColor ?? '#3388ff',
    fillOpacity: style?.fillOpacity ?? 0.2,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function pointToLayer(feature: Feature, latlng: L.LatLng, style?: LayerStyle): L.Layer {
  const color = style?.color ?? '#e6194b';

  // Render a clean, crisp waypoint marker
  return L.circleMarker(latlng, {
    radius: 7,
    fillColor: color,
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9,
  });
}

function onEachFeature(feature: Feature, layer: LeafletLayer) {
  const props = feature.properties;
  if (!props) return;

  const name = props.name || props.title || props.label || '';
  const note = props.note || props.description || props.desc || props.cmt || '';

  if (name || note) {
    const escapedName = escapeHtml(String(name));
    const escapedNote = escapeHtml(String(note));

    const html = `
      <div class="waypoint-popup">
        ${escapedName ? `<div class="waypoint-popup-title">${escapedName}</div>` : ''}
        ${escapedNote ? `<div class="waypoint-popup-note">${escapedNote}</div>` : ''}
      </div>
    `;
    layer.bindPopup(html, { className: 'custom-map-popup' });
  }
}

// ─── Props ────────────────────────────────────────────────────────
interface MapViewProps {
  layers: MapLayer[];
  viewTarget?: ViewTarget | null;
  onMapInit?: (map: LeafletMap) => void;
}

// ─── Component ────────────────────────────────────────────────────
export default function MapView({ layers, viewTarget, onMapInit }: MapViewProps) {
  // Create stable callback ref so we don't re-render the event handler
  const mapInitRef = useRef(onMapInit);
  mapInitRef.current = onMapInit;

  const visibleLayers = useMemo(
    () => layers.filter((l) => l.visible && l.data !== null),
    [layers],
  );

  return (
    <div className="map-container">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={true}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEventHandler
          onMapReady={(map) => mapInitRef.current?.(map)}
        />

        <MapViewportController target={viewTarget} />

        {visibleLayers.map((layer) => (
          <GeoJSON
            key={`${layer.id}-${layer.updatedAt}-${layer.style?.color ?? 'default'}`}
            data={layer.data!}
            style={makeStyle(layer.style)}
            pointToLayer={(feature, latlng) => pointToLayer(feature, latlng, layer.style)}
            onEachFeature={onEachFeature}
          />
        ))}
      </MapContainer>
    </div>
  );
}
