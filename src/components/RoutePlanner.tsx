import { useState } from 'react';
import type { GeoJSON } from 'geojson';
import type { RouteWaypoint } from '../types';
import { getRoute } from '../utils/osrm';
import { uid } from '../utils/id';

interface RoutePlannerProps {
  onRouteCreated: (name: string, geojson: GeoJSON, distance: number, duration: number) => void;
  onClose: () => void;
}

export default function RoutePlanner({ onRouteCreated, onClose }: RoutePlannerProps) {
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([
    { lat: 0, lon: 0, label: 'Start' },
    { lat: 0, lon: 0, label: 'End' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateWaypoint(index: number, field: 'lat' | 'lon', value: string) {
    setWaypoints((prev) =>
      prev.map((wp, i) =>
        i === index ? { ...wp, [field]: parseFloat(value) || 0 } : wp,
      ),
    );
  }

  function addWaypoint() {
    setWaypoints((prev) => [
      ...prev.slice(0, -1),
      { lat: 0, lon: 0, label: `Stop ${prev.length - 1}` },
      prev[prev.length - 1],
    ]);
  }

  function removeWaypoint(index: number) {
    if (waypoints.length <= 2) return;
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const valid = waypoints.filter((wp) => wp.lat !== 0 || wp.lon !== 0);
      if (valid.length < 2) {
        throw new Error('Enter at least two valid waypoints');
      }

      const route = await getRoute(valid);
      const distKm = (route.distance / 1000).toFixed(1);
      const durMin = Math.round(route.duration / 60);

      onRouteCreated(
        `Route (${distKm} km, ${durMin} min)`,
        route.geometry,
        route.distance,
        route.duration,
      );
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch route');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 12, color: '#667085', marginBottom: 12 }}>
        Enter lat/lon coordinates for each waypoint. The route is fetched from
        the public OSRM demo server (driving).
      </p>

      {waypoints.map((wp, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, width: 50, flexShrink: 0 }}>
            {wp.label ?? `#${i + 1}`}
          </span>
          <input
            type="number"
            step="any"
            placeholder="Lat"
            value={wp.lat || ''}
            onChange={(e) => updateWaypoint(i, 'lat', e.target.value)}
            style={{ width: 100, padding: '4px 8px', fontSize: 12, border: '1px solid #d0d5dd', borderRadius: 6 }}
          />
          <input
            type="number"
            step="any"
            placeholder="Lon"
            value={wp.lon || ''}
            onChange={(e) => updateWaypoint(i, 'lon', e.target.value)}
            style={{ width: 100, padding: '4px 8px', fontSize: 12, border: '1px solid #d0d5dd', borderRadius: 6 }}
          />
          {waypoints.length > 2 && (
            <button type="button" className="btn-icon" onClick={() => removeWaypoint(i)} title="Remove">
              ✕
            </button>
          )}
        </div>
      ))}

      <button type="button" className="btn btn-sm" onClick={addWaypoint} style={{ marginBottom: 10 }}>
        + Add stop
      </button>

      {error && <p style={{ fontSize: 12, color: '#d92d20', marginBottom: 8 }}>{error}</p>}

      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Routing…' : 'Get Route'}
        </button>
      </div>
    </form>
  );
}
