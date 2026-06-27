import { useState, useCallback } from 'react';
import type { GeoJSON } from 'geojson';
import type { SearchResult, ModalMode } from './types';
import { useMapLayers } from './hooks/useMapLayers';
import MapView from './components/MapView';
import LayerPanel from './components/LayerPanel';
import SearchBox from './components/SearchBox';
import GeoJSONUploader from './components/GeoJSONUploader';
import RoutePlanner from './components/RoutePlanner';

export default function App() {
  const {
    layers,
    addLayer,
    addLayerWithData,
    removeLayer,
    toggleLayer,
    updateLayerStyle,
    renameLayer,
  } = useMapLayers();

  const [modal, setModal] = useState<ModalMode>(null);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom?: number } | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  // ── Search: create a point layer from the result & fly to it ──
  const handleSearchResult = useCallback(
    (result: SearchResult) => {
      const pointFeature: GeoJSON = {
        type: 'Feature',
        properties: {
          name: result.displayName,
          type: result.type,
        },
        geometry: {
          type: 'Point',
          coordinates: [result.lon, result.lat],
        },
      };

      addLayerWithData(
        result.displayName.length > 50
          ? result.displayName.slice(0, 50) + '…'
          : result.displayName,
        pointFeature,
        { color: '#e6194b', fillColor: '#e6194b', fillOpacity: 0.4, weight: 2 },
      );

      setFlyTo({ center: [result.lat, result.lon], zoom: 14 });
    },
    [addLayerWithData],
  );

  // ── GeoJSON import ─────────────────────────────────────────────
  const handleGeoJSONImport = useCallback(
    (name: string, data: GeoJSON) => {
      addLayerWithData(name, data);
      // Try to fly to the imported data bounds
      // (leaflet's GeoJSON component has a getBounds method, but we keep it simple)
    },
    [addLayerWithData],
  );

  // ── Route created ──────────────────────────────────────────────
  const handleRouteCreated = useCallback(
    (name: string, geojson: GeoJSON, _distance: number, _duration: number) => {
      addLayerWithData(name, geojson, {
        color: '#4363d8',
        weight: 5,
        opacity: 0.9,
        fillOpacity: 0,
      });
    },
    [addLayerWithData],
  );

  // ── Color change ───────────────────────────────────────────────
  const handleColorChange = useCallback(
    (id: string, color: string) => {
      updateLayerStyle(id, { color, fillColor: color });
    },
    [updateLayerStyle],
  );

  // ── FlyTo from route / search ──────────────────────────────────
  // (In a real app we'd auto-fit bounds; for now we rely on the search fly-to.)

  // ── Modals ─────────────────────────────────────────────────────
  function closeModal() {
    setModal(null);
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
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

      {/* Map */}
      <MapView
        layers={layers}
        flyTo={flyTo}
        onMapInit={(m) => setMap(m)}
      />

      {/* Modals */}
      {modal === 'search' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>🔍 Search Places</h2>
            <SearchBox onResultClick={handleSearchResult} onClose={closeModal} />
          </div>
        </div>
      )}

      {modal === 'add-geojson' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>📄 Import GeoJSON</h2>
            <GeoJSONUploader onImport={handleGeoJSONImport} onClose={closeModal} />
          </div>
        </div>
      )}

      {modal === 'add-route' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>🗺️ Plan Route</h2>
            <RoutePlanner onRouteCreated={handleRouteCreated} onClose={closeModal} />
          </div>
        </div>
      )}
    </div>
  );
}
