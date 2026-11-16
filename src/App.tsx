import { useState, useCallback, useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { GeoJSON } from 'geojson';
import { Search, Compass, UploadCloud, LocateFixed, Plus, Minus, X } from 'lucide-react';
import type { SearchResult, ModalMode, MapLayer, SearchBounds, ViewTarget, CategorySearch } from './types';
import { categoryResultsToGeoJSON, getCategoryById, searchCategory } from './utils/postpass';
import { useMapLayers } from './hooks/useMapLayers';
import { useUserLocation } from './hooks/useUserLocation';
import MapView from './components/MapView';
import LayerCards from './components/LayerCards';
import SearchBox from './components/SearchBox';
import RouteImporter from './components/RouteImporter';
import RoutePlanner from './components/RoutePlanner';
import ModalDialog from './components/ModalDialog';

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
    layers, addLayerWithData, removeLayer, toggleLayer,
    renameLayer, updateLayerData,
  } = useMapLayers();

  const { coords: userCoords, loading: locatingUser, requestLocation } = useUserLocation();

  const [modal, setModal] = useState<ModalMode>(null);
  const [viewTarget, setViewTarget] = useState<ViewTarget | null>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [currentBounds, setCurrentBounds] = useState<SearchBounds | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [updatingLayerId, setUpdatingLayerId] = useState<string | null>(null);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const categoryUpdateRef = useRef<{ layerId: string; controller: AbortController } | null>(null);
  const initializedRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);

  // Current map viewport for search scoping and category refresh state.
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

  // Initial bounds setup for layers (if any exist)
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

  // Center/scroll map to user location on initial load once obtained
  useEffect(() => {
    if (!userCoords || hasCenteredOnUserRef.current) return;
    hasCenteredOnUserRef.current = true;
    // If there are no existing layers shown, pan & zoom to the user's location
    const visibleWithData = layers.filter((l) => l.visible && l.data !== null);
    if (visibleWithData.length === 0) {
      setViewTarget({ type: 'center', center: userCoords, zoom: 15 });
    }
  }, [userCoords, layers]);

  useEffect(() => {
    if (!map) {
      setCurrentBounds(null);
      return;
    }
    const updateBounds = () => setCurrentBounds(getBounds());
    updateBounds();
    map.on('moveend', updateBounds);
    map.on('resize', updateBounds);
    return () => {
      map.off('moveend', updateBounds);
      map.off('resize', updateBounds);
    };
  }, [map, getBounds]);

  // Older saved category layers did not record their original viewport.
  useEffect(() => {
    if (!map) return;
    const pending = layers.filter((layer) =>
      layer.categorySearch && !layer.categorySearch.bounds && layer.data,
    );
    if (pending.length === 0) return;

    let completed = false;
    const setInitialBaselines = () => {
      if (completed) return;
      completed = true;
      const bounds = getBounds();
      if (!bounds) return;
      for (const layer of pending) {
        updateLayerData(layer.id, layer.data!, bounds);
      }
    };

    // Let initial fitBounds/viewTarget movement settle before marking the baseline.
    map.once('moveend', setInitialBaselines);
    const timer = setTimeout(setInitialBaselines, 1100);
    return () => {
      map.off('moveend', setInitialBaselines);
      clearTimeout(timer);
    };
  }, [map, layers, getBounds, updateLayerData]);

  const handleLocateClick = useCallback(() => {
    if (userCoords) {
      setViewTarget({ type: 'center', center: userCoords, zoom: 15 });
    } else {
      requestLocation((coords) => {
        setViewTarget({ type: 'center', center: coords, zoom: 15 });
      });
    }
  }, [userCoords, requestLocation]);

  const handleSearchResult = useCallback((result: SearchResult) => {
    const pointFeature: GeoJSON = {
      type: 'Feature',
      properties: { name: result.displayName, type: result.type },
      geometry: { type: 'Point', coordinates: [result.lon, result.lat] },
    };
    addLayerWithData(
      result.displayName.length > 40 ? result.displayName.slice(0, 40) + '…' : result.displayName,
      pointFeature,
      { fillOpacity: 0.25, weight: 2 },
    );
    setViewTarget({ type: 'center', center: [result.lat, result.lon], zoom: 14 });
  }, [addLayerWithData]);

  const handleCategoryResults = useCallback((
    results: SearchResult[],
    category: CategorySearch,
    selected?: SearchResult,
  ) => {
    const data = categoryResultsToGeoJSON(results);
    addLayerWithData(
      category.label,
      data,
      { fillOpacity: 0.25, weight: 2 },
      results.length > 1
        ? { ...category, bounds: getBounds() ?? undefined }
        : undefined,
    );
    if (selected) {
      setViewTarget({ type: 'center', center: [selected.lat, selected.lon], zoom: 16 });
    }
  }, [addLayerWithData, getBounds]);

  const handleGeoJSONImport = useCallback((name: string, data: GeoJSON) => {
    addLayerWithData(name, data, { weight: 4, opacity: 0.9, fillOpacity: 0.15 });
    const bounds = getGeoJSONBounds(data);
    if (bounds) {
      setViewTarget({ type: 'bounds', bounds, padding: [60, 60] });
    }
  }, [addLayerWithData]);

  const handleRouteCreated = useCallback((name: string, geojson: GeoJSON, _d: number, _dur: number) => {
    addLayerWithData(name, geojson, { weight: 4.5, opacity: 0.95, fillOpacity: 0 });
    const bounds = getGeoJSONBounds(geojson);
    if (bounds) {
      setViewTarget({ type: 'bounds', bounds, padding: [60, 60] });
    }
  }, [addLayerWithData]);

  const handleFocusLayer = useCallback((layer: MapLayer) => {
    setActiveLayerId(layer.id);
    if (!layer.data) return;
    const bounds = getGeoJSONBounds(layer.data);
    if (bounds) {
      setViewTarget({ type: 'bounds', bounds, padding: [60, 60] });
    }
  }, []);

  const handleRemoveLayer = useCallback((id: string) => {
    if (categoryUpdateRef.current?.layerId === id) {
      categoryUpdateRef.current.controller.abort();
      categoryUpdateRef.current = null;
      setUpdatingLayerId(null);
    }
    removeLayer(id);
    setActiveLayerId((current) => current === id ? null : current);
  }, [removeLayer]);

  const handleUpdateLayer = useCallback(async (layer: MapLayer) => {
    if (!layer.categorySearch || categoryUpdateRef.current) return;
    const category = getCategoryById(layer.categorySearch.id);
    if (!category) {
      setMapNotice('This category is no longer supported. Existing results were kept.');
      return;
    }
    const bounds = getBounds();
    if (!bounds) {
      setMapNotice('Map bounds are unavailable. Move the map and try again.');
      return;
    }

    const controller = new AbortController();
    categoryUpdateRef.current = { layerId: layer.id, controller };
    setUpdatingLayerId(layer.id);
    setMapNotice(null);

    try {
      const { results } = await searchCategory(category, bounds, controller.signal);
      if (results.length === 0) {
        throw new Error(`No ${category.label.toLowerCase()} found in this map view. Existing results were kept.`);
      }
      updateLayerData(layer.id, categoryResultsToGeoJSON(results), bounds);
      setActiveLayerId(layer.id);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setMapNotice(error instanceof Error ? error.message : 'Could not update this layer. Please try again.');
    } finally {
      if (categoryUpdateRef.current?.controller === controller) {
        categoryUpdateRef.current = null;
        setUpdatingLayerId(null);
      }
    }
  }, [getBounds, updateLayerData]);

  useEffect(() => () => {
    categoryUpdateRef.current?.controller.abort();
    categoryUpdateRef.current = null;
  }, []);

  function closeModal() { setModal(null); }

  return (
    <div className="app-layout">
      {/* Map view is full screen */}
      <MapView
        layers={layers}
        viewTarget={viewTarget}
        userLocation={userCoords}
        onMapInit={(m) => setMap(m)}
      />

      {/* Floating map controls */}
      <div className="map-floating-controls">
        <div className="zoom-controls" role="group" aria-label="Map zoom controls">
          <button
            type="button"
            className="zoom-btn"
            onClick={() => map?.zoomIn()}
            disabled={!map}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="zoom-btn"
            onClick={() => map?.zoomOut()}
            disabled={!map}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className={`locate-btn ${locatingUser ? 'locating' : ''}`}
          onClick={handleLocateClick}
          title={userCoords ? 'Zoom to your location' : 'Find your location'}
          aria-label="Find my location"
        >
          <LocateFixed size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* Floating Bottom Dock (Layer cards + Actions) */}
      <div className="bottom-dock">
        {mapNotice && (
          <div className="map-notice" role="alert">
            <span>{mapNotice}</span>
            <button type="button" onClick={() => setMapNotice(null)} aria-label="Dismiss update error" title="Dismiss">
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        )}

        <LayerCards
          layers={layers}
          activeLayerId={activeLayerId}
          onToggle={toggleLayer}
          onRemove={handleRemoveLayer}
          onRename={renameLayer}
          onFocusLayer={handleFocusLayer}
          onUpdate={handleUpdateLayer}
          updatingLayerId={updatingLayerId}
          currentBounds={currentBounds}
        />

        <div className="bottom-action-bar">
          <button
            type="button"
            className={`action-bar-btn ${modal === 'search' ? 'active' : ''}`}
            onClick={() => setModal('search')}
          >
            <Search size={18} strokeWidth={2} />
            <span>Search</span>
          </button>

          <button
            type="button"
            className={`action-bar-btn ${modal === 'add-route' ? 'active' : ''}`}
            onClick={() => setModal('add-route')}
          >
            <Compass size={18} strokeWidth={2} />
            <span>New Route</span>
          </button>

          <button
            type="button"
            className={`action-bar-btn ${modal === 'add-geojson' ? 'active' : ''}`}
            onClick={() => setModal('add-geojson')}
          >
            <UploadCloud size={18} strokeWidth={2} />
            <span>Import</span>
          </button>
        </div>
      </div>

      {modal === 'search' && (
        <ModalDialog id="search" title="Search" onClose={closeModal}>
          <SearchBox
            onResultClick={handleSearchResult}
            onCategoryResults={handleCategoryResults}
            onClose={closeModal}
            getBounds={getBounds}
          />
        </ModalDialog>
      )}

      {modal === 'add-geojson' && (
        <ModalDialog id="upload" title="Import" onClose={closeModal}>
          <RouteImporter onImport={handleGeoJSONImport} onClose={closeModal} />
        </ModalDialog>
      )}

      {modal === 'add-route' && (
        <ModalDialog id="route" title="New Route" onClose={closeModal}>
          <RoutePlanner
            onRouteCreated={handleRouteCreated}
            onClose={closeModal}
            userCoords={userCoords}
            requestLocation={requestLocation}
            locating={locatingUser}
          />
        </ModalDialog>
      )}
    </div>
  );
}
