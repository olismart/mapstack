import { useCallback, useEffect, useRef, useState } from 'react';
import type { CategorySearch, SearchBounds, SearchResult } from '../types';
import { searchPlaces } from '../utils/nominatim';
import { getCategoryForQuery, searchCategory } from '../utils/postpass';

interface SearchState {
  results: SearchResult[];
  category?: CategorySearch;
  truncated: boolean;
}

const EMPTY_STATE: SearchState = { results: [], truncated: false };

function boundsKey(bounds?: SearchBounds): string {
  if (!bounds) return 'worldwide';
  return [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat]
    .map((value) => value.toFixed(4))
    .join(',');
}

export function usePlaceSearch() {
  const [state, setState] = useState<SearchState>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const cacheRef = useRef(new Map<string, SearchState>());

  const clear = useCallback(() => {
    requestRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState(EMPTY_STATE);
    setLoading(false);
    setError(null);
    setHasSearched(false);
  }, []);

  const search = useCallback(async (query: string, bounds?: SearchBounds) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      clear();
      return;
    }

    const requestId = ++requestRef.current;
    controllerRef.current?.abort();
    controllerRef.current = null;
    const category = getCategoryForQuery(trimmed);
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setState(EMPTY_STATE);

    if (category && !bounds) {
      setError('Map bounds are unavailable. Move the map and try again.');
      setLoading(false);
      return;
    }

    const cacheKey = `${category ? `category:${category.id}` : `place:${trimmed.toLowerCase()}`}:${boundsKey(bounds)}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setState(cached);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const nextState: SearchState = category
        ? await searchCategory(category, bounds!, controller.signal)
        : {
            results: await searchPlaces(trimmed, bounds, controller.signal),
            truncated: false,
          };
      if (requestRef.current !== requestId) return;

      if (cacheRef.current.size >= 20) {
        const oldestKey = cacheRef.current.keys().next().value;
        if (oldestKey) cacheRef.current.delete(oldestKey);
      }
      cacheRef.current.set(cacheKey, nextState);
      setState(nextState);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (requestRef.current !== requestId) return;
      setState(EMPTY_STATE);
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
        controllerRef.current = null;
      }
    }
  }, [clear]);

  useEffect(() => () => {
    requestRef.current += 1;
    controllerRef.current?.abort();
  }, []);

  return { ...state, loading, error, hasSearched, search, clear };
}
