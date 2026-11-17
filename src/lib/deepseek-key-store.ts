const KEY = "omscs-path-builder:deepseek-key:v1";

const listeners = new Set<() => void>();

export function getKeySnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function getKeyServerSnapshot(): string | null {
  return null;
}

export function subscribeKey(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(key: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (key === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, key);
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}

export function saveKey(key: string): void {
  write(key);
}

export function clearKey(): void {
  write(null);
}
