import { useState, useEffect, useCallback } from 'react';

export interface UserLocationState {
  coords: [number, number] | null; // [lat, lng]
  accuracy: number | null;          // in meters
  error: string | null;
  loading: boolean;
}

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocationState>({
    coords: null,
    accuracy: null,
    error: null,
    loading: false,
  });

  const requestLocation = useCallback((onSuccess?: (coords: [number, number]) => void) => {
    if (!navigator.geolocation) {
      setLocation((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by your browser',
        loading: false,
      }));
      return;
    }

    setLocation((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setLocation({
          coords,
          accuracy: pos.coords.accuracy,
          error: null,
          loading: false,
        });
        if (onSuccess) onSuccess(coords);
      },
      (err) => {
        setLocation((prev) => ({
          ...prev,
          error: err.message || 'Unable to retrieve location',
          loading: false,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
      },
    );
  }, []);

  // Request location on initial page load
  useEffect(() => {
    requestLocation();

    // Optionally watch position so it updates if the user is moving
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLocation({
            coords: [pos.coords.latitude, pos.coords.longitude],
            accuracy: pos.coords.accuracy,
            error: null,
            loading: false,
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000 },
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [requestLocation]);

  return { ...location, requestLocation };
}
