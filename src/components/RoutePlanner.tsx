import { useState, useRef, useEffect } from 'react';
import type { GeoJSON } from 'geojson';
import type { RouteProfile } from '../types';
import { getRoute } from '../utils/osrm';
import { searchPlaces } from '../utils/nominatim';

interface RoutePlannerProps {
  onRouteCreated: (name: string, geojson: GeoJSON, distance: number, duration: number) => void;
  onClose: () => void;
}

interface SearchResult {
  displayName: string;
  lat: number;
  lon: number;
}

interface Waypoint {
  label: string;
  lat: number;
  lon: number;
  query: string;
  results: SearchResult[];
  searching: boolean;
  confirmed: boolean;
}

function emptyWp(label: string): Waypoint {
  return { label, lat: 0, lon: 0, query: '', results: [], searching: false, confirmed: false };
}

export default function RoutePlanner({ onRouteCreated, onClose }: RoutePlannerProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    emptyWp('Start'),
    emptyWp('End'),
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<RouteProfile>('driving');
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => timers.current.forEach((t) => clearTimeout(t));
  }, []);

  function search(index: number, query: string) {
    setWaypoints((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], query, confirmed: false, results: [] };
      return next;
    });

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // Clear any pending timer for this index
      const existing = timers.current.get(index);
      if (existing) {
        clearTimeout(existing);
        timers.current.delete(index);
      }
      setWaypoints((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], results: [], searching: false };
        return next;
      });
      return;
    }

    const existing = timers.current.get(index);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      setWaypoints((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], searching: true };
        return next;
      });
      try {
        const data = await searchPlaces(trimmed);
        const mapped: SearchResult[] = data.map((d) => ({
          displayName: d.displayName,
          lat: d.lat,
          lon: d.lon,
        }));
        setWaypoints((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], results: mapped, searching: false };
          return next;
        });
      } catch {
        setWaypoints((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], results: [], searching: false };
          return next;
        });
      }
    }, 400);

    timers.current.set(index, timer);
  }

  function pick(index: number, r: SearchResult) {
    const label = r.displayName.length > 42 ? r.displayName.slice(0, 42) + '…' : r.displayName;
    setWaypoints((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], lat: r.lat, lon: r.lon, label, query: r.displayName, results: [], confirmed: true, searching: false };
      return next;
    });
  }

  function clearWp(index: number) {
    setWaypoints((prev) => {
      const next = [...prev];
      next[index] = emptyWp(prev[index].label);
      return next;
    });
  }

  function addStop() {
    setWaypoints((prev) => {
      const label = `Stop ${prev.length - 1}`;
      return [...prev.slice(0, -1), emptyWp(label), prev[prev.length - 1]];
    });
  }

  function removeStop(index: number) {
    if (waypoints.length <= 2) return;
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const valid = waypoints.filter((wp) => wp.confirmed);
      if (valid.length < 2) throw new Error('Search for at least two locations');

      const route = await getRoute(valid.map((wp) => ({ lat: wp.lat, lon: wp.lon, label: wp.label })), profile);
      const distKm = (route.distance / 1000).toFixed(1);
      const durMin = Math.round(route.duration / 60);

      const profName = profile.charAt(0).toUpperCase() + profile.slice(1);
      const profEmoji = profile === 'driving' ? 'ð' : profile === 'walking' ? 'ð¶' : 'ð²';
      onRouteCreated(`${profEmoji} ${profName} (${distKm} km, ${durMin} min)`, route.geometry, route.distance, route.duration);
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch route');
    } finally {
      setLoading(false);
    }
  }

  const allConfirmed = waypoints.length >= 2 && waypoints.every((wp) => wp.confirmed);

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
          Travel mode
        </label>
        <div className="profile-toggle">
          {(['driving', 'walking', 'cycling'] as RouteProfile[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`profile-btn${profile === p ? ' active' : ''}`}
              onClick={() => setProfile(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {waypoints.map((wp, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label
              htmlFor={`route-stop-input-${i}`}
              style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, minWidth: 48, flexShrink: 0, cursor: 'pointer' }}
            >
              {wp.label}
            </label>

            <div style={{ flex: 1, position: 'relative' }}>
              <input
                id={`route-stop-input-${i}`}
                type="text"
                className="search-input"
                placeholder="Search address or place..."
                value={wp.query}
                onChange={(e) => search(i, e.target.value)}
                aria-label={`Location for stop ${i + 1} (${wp.label})`}
                style={{ paddingRight: 36, borderColor: wp.confirmed ? '#3cb44b' : undefined }}
              />

              {wp.searching && <span style={{ position: 'absolute', right: 10, top: 10, fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }} aria-live="polite">...</span>}
              {wp.confirmed && <span style={{ position: 'absolute', right: 10, top: 10, fontSize: 'var(--font-size-base)', color: '#3cb44b', fontWeight: 600 }} aria-label="Stop confirmed">OK</span>}

              {wp.results.length > 0 && !wp.confirmed && (
                <ul className="search-results" role="listbox" aria-label={`Location suggestions for ${wp.label}`}>
                  {wp.results.map((r, ri) => (
                    <li key={ri} role="presentation">
                      <button
                        type="button"
                        role="option"
                        className="search-result-item"
                        onClick={() => pick(i, r)}
                      >
                        {r.displayName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {wp.confirmed ? (
              <button
                type="button"
                className="btn-icon"
                onClick={() => clearWp(i)}
                title="Change stop location"
                aria-label={`Change stop ${i + 1} (${wp.label}) location`}
              >
                Edit
              </button>
            ) : waypoints.length > 2 ? (
              <button
                type="button"
                className="btn-icon"
                onClick={() => removeStop(i)}
                title="Remove stop"
                aria-label={`Remove stop ${i + 1} (${wp.label})`}
                style={{ color: '#d92d20' }}
              >
                X
              </button>
            ) : null}
          </div>

          {wp.confirmed && (
            <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginLeft: 56, marginTop: 4 }}>
              {wp.lat.toFixed(5)}, {wp.lon.toFixed(5)}
            </div>
          )}
        </div>
      ))}

      <button type="button" className="btn btn-secondary btn-sm" onClick={addStop} style={{ marginBottom: 14 }}>+ Add stop</button>

      {error && <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}

      <div className="modal-actions">
        <button type="submit" className="btn btn-primary" disabled={loading || !allConfirmed}>
          {loading ? 'Routing...' : allConfirmed ? 'Get Route' : 'Confirm all stops to route'}
        </button>
      </div>
    </form>
  );
}
