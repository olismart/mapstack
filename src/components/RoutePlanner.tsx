import { useState, useRef, useEffect } from 'react';
import type { GeoJSON } from 'geojson';
import type { RouteProfile } from '../types';
import { getRoute } from '../utils/osrm';
import { searchPlaces } from '../utils/nominatim';
import { parseGPX } from '../utils/gpx';

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
  const [gpxError, setGpxError] = useState<string | null>(null);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const gpxFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => timers.current.forEach((t) => clearTimeout(t));
  }, []);

  function handleGPXUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setGpxError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
    if (file.size > MAX_SIZE) {
      setGpxError('GPX file exceeds 25 MB limit');
      e.target.value = '';
      return;
    }

    const defaultName = file.name.replace(/\.gpx$/i, '');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const result = parseGPX(text, defaultName);
        onRouteCreated(result.name || defaultName, result.geojson, result.distance, result.duration);
        onClose();
      } catch (err: any) {
        setGpxError(err.message || 'Failed to parse GPX file');
      }
    };
    reader.onerror = () => {
      setGpxError('Failed to read file');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

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
    <div>
      <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>Import GPS Route (.gpx)</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Upload routes or tracks from Garmin, Strava, etc.</div>
          </div>
          <div>
            <input
              ref={gpxFileInputRef}
              type="file"
              accept=".gpx,application/gpx+xml"
              onChange={handleGPXUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => gpxFileInputRef.current?.click()}
            >
              📂 Choose GPX File
            </button>
          </div>
        </div>
        {gpxError && <p style={{ fontSize: 12, color: '#d92d20', marginTop: 8, marginBottom: 0 }}>{gpxError}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0', color: '#94a3b8', fontSize: 12 }}>
        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        <span>OR PLAN ONLINE</span>
        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
      </div>

      <form onSubmit={handleSubmit}>
        <p style={{ fontSize: 12, color: '#667085', marginBottom: 12 }}>
          Type an address, city or point of interest for each stop. The route comes
          from the public OSRM demo server.
        </p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#344054', display: 'block', marginBottom: 6 }}>
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
              {p === 'driving' ? '🚗' : p === 'walking' ? '🚶' : '🚲'} {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {waypoints.map((wp, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 11, fontWeight: 600, minWidth: 42, paddingTop: 10, flexShrink: 0 }}>
              {wp.label}
            </span>

            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Search address or place..."
                value={wp.query}
                onChange={(e) => search(i, e.target.value)}
                style={{ paddingRight: 30, borderColor: wp.confirmed ? '#3cb44b' : undefined }}
              />

              {wp.searching && <span style={{ position: 'absolute', right: 8, top: 8, fontSize: 12, color: '#98a2b3' }}>...</span>}
              {wp.confirmed && <span style={{ position: 'absolute', right: 8, top: 8, fontSize: 12, color: '#3cb44b', fontWeight: 600 }}>OK</span>}

              {wp.results.length > 0 && !wp.confirmed && (
                <ul className="search-results">
                  {wp.results.map((r, ri) => (
                    <li key={ri} className="search-result-item" onClick={() => pick(i, r)}>
                      {r.displayName}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {wp.confirmed ? (
              <button type="button" className="btn-icon" onClick={() => clearWp(i)} title="Change" style={{ marginTop: 4 }}>Edit</button>
            ) : waypoints.length > 2 ? (
              <button type="button" className="btn-icon" onClick={() => removeStop(i)} title="Remove" style={{ marginTop: 4, color: '#d92d20' }}>X</button>
            ) : null}
          </div>

          {wp.confirmed && (
            <div style={{ fontSize: 11, color: '#98a2b3', marginLeft: 50, marginTop: 2 }}>
              {wp.lat.toFixed(5)}, {wp.lon.toFixed(5)}
            </div>
          )}
        </div>
      ))}

      <button type="button" className="btn btn-sm" onClick={addStop} style={{ marginBottom: 12 }}>+ Add stop</button>

      {error && <p style={{ fontSize: 12, color: '#d92d20', marginBottom: 8 }}>{error}</p>}

      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading || !allConfirmed}>
          {loading ? 'Routing...' : allConfirmed ? 'Get Route' : 'Confirm all stops to route'}
        </button>
      </div>
    </form>
  </div>
  );
}
