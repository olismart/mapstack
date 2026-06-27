/** Generate a simple unique id (not crypto-secure, fine for UI state) */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
