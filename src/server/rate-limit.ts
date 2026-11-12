/**
 * Limiteur de tentatives simple, en mémoire (fenêtre glissante).
 * Suffisant pour une seule instance de l'application ; à remplacer par un stockage partagé
 * si l'application est un jour répartie sur plusieurs instances.
 */
const attempts = new Map<string, number[]>();

export function isRateLimited(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  attempts.set(key, recent);
  return recent.length >= max;
}

export function recordAttempt(key: string, now = Date.now()): void {
  const list = attempts.get(key) ?? [];
  list.push(now);
  attempts.set(key, list);
}

export function resetAttempts(key: string): void {
  attempts.delete(key);
}
