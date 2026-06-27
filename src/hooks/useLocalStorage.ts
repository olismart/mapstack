import { useState, useCallback } from 'react';

const STORAGE_PREFIX = 'mapstack-';

/**
 * React hook that syncs state to localStorage.
 * Falls back to in-memory state if storage is unavailable (private browsing, etc.).
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = STORAGE_PREFIX + key;

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(storageKey);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // storage full or unavailable — silently degrade
        }
        return next;
      });
    },
    [storageKey],
  );

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setStoredValue(defaultValue);
  }, [storageKey, defaultValue]);

  return [storedValue, setValue, removeValue];
}
