import { useCallback } from 'react';
import type { GeoJSON } from 'geojson';
import type { MapLayer, LayerStyle } from '../types';
import { uid } from '../utils/id';
import { useLocalStorage } from './useLocalStorage';

const DEFAULT_STYLE: LayerStyle = {
  color: '#ff4d00',
  weight: 4,
  opacity: 0.9,
  fillColor: '#ff4d00',
  fillOpacity: 0.15,
};

/**
 * Hook managing the list of map layers.
 * Persisted to localStorage so layers survive page reloads.
 */
export function useMapLayers() {
  const [layers, setLayers] = useLocalStorage<MapLayer[]>('layers', []);

  /** Add an empty/new layer with a given name */
  const addLayer = useCallback(
    (name: string) => {
      const layer: MapLayer = {
        id: uid(),
        name,
        visible: true,
        data: null,
        style: { ...DEFAULT_STYLE },
        updatedAt: Date.now(),
      };
      setLayers((prev) => [...prev, layer]);
      return layer;
    },
    [setLayers],
  );

  /** Add a layer with data already populated */
  const addLayerWithData = useCallback(
    (name: string, data: GeoJSON, style?: LayerStyle) => {
      const layer: MapLayer = {
        id: uid(),
        name,
        visible: true,
        data,
        style: style ?? { ...DEFAULT_STYLE },
        updatedAt: Date.now(),
      };
      setLayers((prev) => [...prev, layer]);
      return layer;
    },
    [setLayers],
  );

  /** Remove a layer by id */
  const removeLayer = useCallback(
    (id: string) => {
      setLayers((prev) => prev.filter((l) => l.id !== id));
    },
    [setLayers],
  );

  /** Toggle visibility of a layer */
  const toggleLayer = useCallback(
    (id: string) => {
      setLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
      );
    },
    [setLayers],
  );

  /** Update the data of an existing layer */
  const updateLayerData = useCallback(
    (id: string, data: GeoJSON) => {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, data, updatedAt: Date.now() } : l,
        ),
      );
    },
    [setLayers],
  );

  /** Update style of a layer */
  const updateLayerStyle = useCallback(
    (id: string, style: Partial<LayerStyle>) => {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, style: { ...l.style, ...style } } : l,
        ),
      );
    },
    [setLayers],
  );

  /** Rename a layer */
  const renameLayer = useCallback(
    (id: string, name: string) => {
      setLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, name } : l)),
      );
    },
    [setLayers],
  );

  return {
    layers,
    addLayer,
    addLayerWithData,
    removeLayer,
    toggleLayer,
    updateLayerData,
    updateLayerStyle,
    renameLayer,
  };
}
