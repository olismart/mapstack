import { useState, useCallback, useRef } from 'react';
import type { SearchResult } from '../types';
import { searchPlaces } from '../utils/nominatim';

/**
 * Hook wrapping the Nominatim search with debouncing and loading state.
 */
export function useNominatim() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    // Clear previous debounce timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      try {
        const data = await searchPlaces(trimmed);
        setResults(data);
      } catch (err: any) {
        setError(err.message ?? 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400); // 400ms debounce
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { results, loading, error, search, clear };
}
