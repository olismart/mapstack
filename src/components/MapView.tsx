import { useEffect, useRef, useMemo } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { GeoJSON as GeoJSONType } from 'geojson';
import type { MapLayer, LayerStyle } from '../types';

// ─── Default map centre (London) ──────────────────────────────────
const DEFAULT_CENTER: [number, number] = [51.5074, -0.1278];
const DEFAULT_ZOOM = 10;

// ─── Sub-component to handle fly-to ───────────────────────────────
function FlyTo({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom ?? map.getZoom(), { duration: 1 });
    }
  }, [center, zoom, map]);
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

// ─── Props ────────────────────────────────────────────────────────
interface MapViewProps {
  layers: MapLayer[];
  flyTo?: { center: [number, number]; zoom?: number } | null;
  onMapInit?: (map: LeafletMap) => void;
}

// ─── Component ────────────────────────────────────────────────────
export default function MapView({ layers, flyTo, onMapInit }: MapViewProps) {
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

        {flyTo && <FlyTo center={flyTo.center} zoom={flyTo.zoom} />}

        {visibleLayers.map((layer) => (
          <GeoJSON
            key={layer.id}
            data={layer.data!}
            style={makeStyle(layer.style)}
          />
        ))}
      </MapContainer>
    </div>
  );
}
