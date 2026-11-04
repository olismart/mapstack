import { useEffect, useRef, useMemo } from 'react';
import type { Map as LeafletMap, Layer as LeafletLayer } from 'leaflet';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  ZoomControl,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { GeoJSON as GeoJSONType, Feature } from 'geojson';
import type { MapLayer, LayerStyle, ViewTarget } from '../types';
import { classifyWaypoint, createWaypointMarkerHtml } from '../utils/waypointMarkers';

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
  const meta = classifyWaypoint(feature.properties || {});
  const markerColor = style?.color ?? '#ff4d00';
  const html = createWaypointMarkerHtml(meta.category, markerColor);

  const customIcon = L.divIcon({
    html,
    className: 'waypoint-pin-leaflet',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -32],
  });

  return L.marker(latlng, { icon: customIcon });
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

// ─── User location marker icon (borderless solid accent dot + subtle pulse halo) ─
const userLocationIcon = L.divIcon({
  className: 'user-location-marker-leaflet',
  html: `
    <div class="user-location-pin">
      <div class="user-location-pulse"></div>
      <div class="user-location-dot"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

// ─── Props ────────────────────────────────────────────────────────
interface MapViewProps {
  layers: MapLayer[];
  viewTarget?: ViewTarget | null;
  userLocation?: [number, number] | null;
  onMapInit?: (map: LeafletMap) => void;
}

// ─── Component ────────────────────────────────────────────────────
export default function MapView({ layers, viewTarget, userLocation, onMapInit }: MapViewProps) {
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
        zoomControl={false}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <ZoomControl position="topright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEventHandler
          onMapReady={(map) => mapInitRef.current?.(map)}
        />

        <MapViewportController target={viewTarget} />

        {/* Current user location marker (borderless to differentiate from waypoints) */}
        {userLocation && (
          <Marker position={userLocation} icon={userLocationIcon}>
            <Popup className="custom-map-popup">
              <div className="waypoint-popup">
                <div className="waypoint-popup-title">Current Location</div>
                <div className="waypoint-popup-note">You are here</div>
              </div>
            </Popup>
          </Marker>
        )}

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
