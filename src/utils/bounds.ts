import type { SearchBounds } from '../types';

const BOUNDS_TOLERANCE = 0.000001;

/** Returns true when the current viewport differs meaningfully from the saved query bounds. */
export function haveSearchBoundsChanged(
  previous?: SearchBounds | null,
  current?: SearchBounds | null,
): boolean {
  if (!previous || !current) return false;
  return (
    Math.abs(previous.minLon - current.minLon) > BOUNDS_TOLERANCE ||
    Math.abs(previous.minLat - current.minLat) > BOUNDS_TOLERANCE ||
    Math.abs(previous.maxLon - current.maxLon) > BOUNDS_TOLERANCE ||
    Math.abs(previous.maxLat - current.maxLat) > BOUNDS_TOLERANCE
  );
}
