export type PageValue = string | number | boolean | null | undefined;

export function readPageValue<T extends PageValue>(params: URLSearchParams, key: string, fallback: T): T {
  const value = params.get(key);
  if (value === null) return fallback;
  if (typeof fallback === 'boolean') return (value === 'true' ? true : value === 'false' ? false : fallback) as T;
  if (typeof fallback === 'number') {
    const number = Number(value);
    return (Number.isFinite(number) && number >= 0 && Number.isInteger(number) ? number : fallback) as T;
  }
  return value as T;
}

export function updatePageValue<T extends PageValue>(current: URLSearchParams, key: string, value: T, fallback: T) {
  const next = key === 'project' ? new URLSearchParams() : new URLSearchParams(current);
  if (key === 'group') {
    for (const name of [...next.keys()]) {
      if (name === 'student' || name.includes(':')) next.delete(name);
    }
  }
  if (value === fallback || value === null || value === undefined) next.delete(key);
  else next.set(key, String(value));
  return next;
}
