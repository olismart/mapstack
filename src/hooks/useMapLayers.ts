import { useCallback } from 'react';
import type { GeoJSON } from 'geojson';
import type { MapLayer, LayerStyle } from '../types';
import { uid } from '../utils/id';
import { useLocalStorage } from './useLocalStorage';

export const LAYER_PALETTE = [
  '#ff4d00', // International Orange
  '#2563eb', // Royal Cobalt Blue
  '#059669', // Emerald Green
  '#7c3aed', // Purple
  '#db2777', // Magenta Pink
  '#d97706', // Amber Gold
  '#0891b2', // Teal / Cyan
  '#4f46e5', // Indigo
];

function getNextLayerColor(existingLayers: MapLayer[]): string {
  const usedColors = new Set(
    existingLayers.map((l) => l.style?.color).filter(Boolean) as string[],
  );
  const available = LAYER_PALETTE.find((c) => !usedColors.has(c));
  if (available) return available;
  return LAYER_PALETTE[existingLayers.length % LAYER_PALETTE.length];
}

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
      let createdLayer: MapLayer | null = null;
      setLayers((prev) => {
        const nextColor = getNextLayerColor(prev);
        const layer: MapLayer = {
          id: uid(),
          name,
          visible: true,
          data: null,
          style: {
            ...DEFAULT_STYLE,
            color: nextColor,
            fillColor: nextColor,
          },
          updatedAt: Date.now(),
        };
        createdLayer = layer;
        return [...prev, layer];
      });
      return createdLayer;
    },
    [setLayers],
  );

  /** Add a layer with data already populated */
  const addLayerWithData = useCallback(
    (name: string, data: GeoJSON, style?: LayerStyle) => {
      let createdLayer: MapLayer | null = null;
      setLayers((prev) => {
        const nextColor = getNextLayerColor(prev);
        const resolvedColor = style?.color ?? nextColor;
        const resolvedStyle: LayerStyle = {
          ...DEFAULT_STYLE,
          fillColor: resolvedColor,
          ...style,
          color: resolvedColor,
        };
        const layer: MapLayer = {
          id: uid(),
          name,
          visible: true,
          data,
          style: resolvedStyle,
          updatedAt: Date.now(),
        };
        createdLayer = layer;
        return [...prev, layer];
      });
      return createdLayer;
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
