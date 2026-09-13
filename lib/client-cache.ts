export type CachedValue<Value> = { value: Value; updatedAt: number };

type Loader<Value> = () => Promise<Value>;

/**
 * A deliberately small, tab-lifetime cache for route data. It keeps navigation responsive
 * without replacing the persistent snapshots used for offline support.
 */
export function createClientCache(now = () => Date.now()) {
  const values = new Map<string, CachedValue<unknown>>();
  const requests = new Map<string, Promise<unknown>>();

  function read<Value>(key: string): CachedValue<Value> | null {
    return (values.get(key) as CachedValue<Value> | undefined) ?? null;
  }

  function isFresh(key: string, maxAgeMs: number) {
    const cached = values.get(key);
    return Boolean(cached && now() - cached.updatedAt < maxAgeMs);
  }

  function set<Value>(key: string, value: Value) {
    values.set(key, { value, updatedAt: now() });
    return value;
  }

  function fetch<Value>(key: string, loader: Loader<Value>) {
    const pending = requests.get(key) as Promise<Value> | undefined;
    if (pending) return pending;

    const request = loader()
      .then((value) => set(key, value))
      .finally(() => requests.delete(key));
    requests.set(key, request);
    return request;
  }

  function load<Value>(key: string, maxAgeMs: number, loader: Loader<Value>) {
    const cached = read<Value>(key);
    return cached && isFresh(key, maxAgeMs) ? Promise.resolve(cached.value) : fetch(key, loader);
  }

  function invalidate(key: string) {
    values.delete(key);
  }

  function invalidateMatching(prefix: string) {
    for (const key of values.keys()) if (key.startsWith(prefix)) values.delete(key);
  }

  return { fetch, invalidate, invalidateMatching, isFresh, load, read, set };
}

export const clientCache = createClientCache();
