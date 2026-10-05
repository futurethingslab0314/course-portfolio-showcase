let tail: Promise<unknown> = Promise.resolve();

// Course and assignment writes must never overlap within this server instance.
export function serializeSync<T>(run: () => Promise<T>): Promise<T> {
  const next = tail.then(run);
  tail = next.catch(() => undefined);
  return next;
}
