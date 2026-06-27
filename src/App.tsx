import { useState, useCallback } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { GeoJSON } from 'geojson';
import type { SearchResult, ModalMode } from './types';
import { useMapLayers } from './hooks/useMapLayers';
import MapView from './components/MapView';
import LayerPanel from './components/LayerPanel';
import SearchBox from './components/SearchBox';
import GeoJSONUploader from './components/GeoJSONUploader';
import RoutePlanner from './components/RoutePlanner';

function getGeoJSONBounds(data: GeoJSON): { center: [number, number]; zoom: number } | null {
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
  const center: [number, number] = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
  const span = Math.max(maxLat - minLat, maxLng - minLng);
  let zoom = 13;
  if (span > 5) zoom = 8;
  else if (span > 1) zoom = 10;
  else if (span > 0.2) zoom = 12;
  else if (span > 0.05) zoom = 14;
  else zoom = 16;
  return { center, zoom };
}

export default function App() {
  const {
    layers, addLayer, addLayerWithData, removeLayer, toggleLayer,
    updateLayerStyle, renameLayer,
  } = useMapLayers();

  const [modal, setModal] = useState<ModalMode>(null);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom?: number } | null>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);

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
    setFlyTo({ center: [result.lat, result.lon], zoom: 14 });
  }, [addLayerWithData]);

  const handleGeoJSONImport = useCallback((name: string, data: GeoJSON) => {
    addLayerWithData(name, data);
    const bounds = getGeoJSONBounds(data);
    if (bounds) setFlyTo(bounds);
  }, [addLayerWithData]);

  const handleRouteCreated = useCallback((name: string, geojson: GeoJSON, _d: number, _dur: number) => {
    addLayerWithData(name, geojson, { color: '#4363d8', weight: 5, opacity: 0.9, fillOpacity: 0 });
    const bounds = getGeoJSONBounds(geojson);
    if (bounds) setFlyTo(bounds);
  }, [addLayerWithData]);

  const handleColorChange = useCallback((id: string, color: string) => {
    updateLayerStyle(id, { color, fillColor: color });
  }, [updateLayerStyle]);

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

      <MapView layers={layers} flyTo={flyTo} onMapInit={(m) => setMap(m)} />

      {modal === 'search' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Search Places</h2>
            <SearchBox onResultClick={handleSearchResult} onClose={closeModal} />
          </div>
        </div>
      )}

      {modal === 'add-geojson' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Import GeoJSON</h2>
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
