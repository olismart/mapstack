import { useState, useCallback, useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { GeoJSON } from 'geojson';
import type { SearchResult, ModalMode, MapLayer, SearchBounds, ViewTarget } from './types';
import { useMapLayers } from './hooks/useMapLayers';
import MapView from './components/MapView';
import LayerPanel from './components/LayerPanel';
import SearchBox from './components/SearchBox';
import GeoJSONUploader from './components/GeoJSONUploader';
import RoutePlanner from './components/RoutePlanner';

export type LatLngBoundsLiteral = [[number, number], [number, number]];

export function getGeoJSONBounds(data: GeoJSON): LatLngBoundsLiteral | null {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;

  function walkCoords(coords: any) {
    if (!coords) return;
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      if (lat != null) { if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat; }
      if (lng != null) { if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng; }
    } else {
      coords.forEach(walkCoords);
    }
  }

  function walkGeometry(geom: any) {
    if (!geom) return;
    if (geom.type === 'GeometryCollection') geom.geometries.forEach(walkGeometry);
    else walkCoords(geom.coordinates);
  }

  if (data.type === 'FeatureCollection') data.features.forEach((f: any) => walkGeometry(f.geometry));
  else if (data.type === 'Feature') walkGeometry(data.geometry);
  else if (data.type === 'GeometryCollection') data.geometries.forEach(walkGeometry);
  else walkCoords(data.coordinates);

  if (minLat === Infinity) return null;
  return [[minLat, minLng], [maxLat, maxLng]];
}

export function getCombinedBounds(layers: MapLayer[]): LatLngBoundsLiteral | null {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;

  function walkCoords(coords: any) {
    if (!coords) return;
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      if (lat != null) { if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat; }
      if (lng != null) { if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng; }
    } else {
      coords.forEach(walkCoords);
    }
  }

  function walkGeometry(geom: any) {
    if (!geom) return;
    if (geom.type === 'GeometryCollection') geom.geometries.forEach(walkGeometry);
    else walkCoords(geom.coordinates);
  }

  for (const layer of layers) {
    if (!layer.data) continue;
    if (layer.data.type === 'FeatureCollection') layer.data.features.forEach((f: any) => walkGeometry(f.geometry));
    else if (layer.data.type === 'Feature') walkGeometry(layer.data.geometry);
    else if (layer.data.type === 'GeometryCollection') layer.data.geometries.forEach((g: any) => walkGeometry(g));
    else walkCoords(layer.data.coordinates);
  }

  if (minLat === Infinity) return null;
  return [[minLat, minLng], [maxLat, maxLng]];
}
export default function App() {
  const {
    layers, addLayer, addLayerWithData, removeLayer, toggleLayer,
    updateLayerStyle, renameLayer,
  } = useMapLayers();

  const [modal, setModal] = useState<ModalMode>(null);
  const [viewTarget, setViewTarget] = useState<ViewTarget | null>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!map || initializedRef.current) return;
    initializedRef.current = true;
    const visibleWithData = layers.filter((l) => l.visible && l.data !== null);
    if (visibleWithData.length === 0) return;
    const bounds = getCombinedBounds(visibleWithData);
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [map, layers]);

  const handleSearchResult = useCallback((result: SearchResult) => {
    const pointFeature: GeoJSON = {
      type: 'Feature',
      properties: { name: result.displayName, type: result.type },
      geometry: { type: 'Point', coordinates: [result.lon, result.lat] },
    };
    addLayerWithData(
      result.displayName.length > 50 ? result.displayName.slice(0, 50) + '…' : result.displayName,
      pointFeature,
      { color: '#e6194b', fillColor: '#e6194b', fillOpacity: 0.4, weight: 2 },
    );
    setViewTarget({ type: 'center', center: [result.lat, result.lon], zoom: 14 });
  }, [addLayerWithData]);

  const handleGeoJSONImport = useCallback((name: string, data: GeoJSON) => {
    addLayerWithData(name, data);
    const bounds = getGeoJSONBounds(data);
    if (bounds) {
      setViewTarget({ type: 'bounds', bounds, padding: [60, 60] });
    }
  }, [addLayerWithData]);

  const handleRouteCreated = useCallback((name: string, geojson: GeoJSON, _d: number, _dur: number) => {
    addLayerWithData(name, geojson, { color: '#4363d8', weight: 5, opacity: 0.9, fillOpacity: 0 });
    const bounds = getGeoJSONBounds(geojson);
    if (bounds) {
      setViewTarget({ type: 'bounds', bounds, padding: [60, 60] });
    }
  }, [addLayerWithData]);

  const handleColorChange = useCallback((id: string, color: string) => {
    updateLayerStyle(id, { color, fillColor: color });
  }, [updateLayerStyle]);

  // Capture current map viewport for smart search scoping
  const getBounds = useCallback((): SearchBounds | null => {
    if (!map) return null;
    const b = map.getBounds();
    return {
      minLon: b.getWest(),
      minLat: b.getSouth(),
      maxLon: b.getEast(),
      maxLat: b.getNorth(),
    };
  }, [map]);

  function closeModal() { setModal(null); }

  return (
    <div className="app-layout">
      <div className="sidebar">
        <LayerPanel
          layers={layers}
          onToggle={toggleLayer}
          onRemove={removeLayer}
          onRename={renameLayer}
          onColorChange={handleColorChange}
          onOpenSearch={() => setModal('search')}
          onOpenGeoJSON={() => setModal('add-geojson')}
          onOpenRoute={() => setModal('add-route')}
        />
      </div>

      <MapView layers={layers} viewTarget={viewTarget} onMapInit={(m) => setMap(m)} />

      {modal === 'search' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Search Places</h2>
            <SearchBox onResultClick={handleSearchResult} onClose={closeModal} getBounds={getBounds} />
          </div>
        </div>
      )}

      {modal === 'add-geojson' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Import GeoJSON / GPX</h2>
            <GeoJSONUploader onImport={handleGeoJSONImport} onClose={closeModal} />
          </div>
        </div>
      )}

      {modal === 'add-route' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Plan Route</h2>
            <RoutePlanner onRouteCreated={handleRouteCreated} onClose={closeModal} />
          </div>
        </div>
      )}
    </div>
  );
}
