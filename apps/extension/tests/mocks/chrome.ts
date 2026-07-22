import { vi } from "vitest";

/**
 * Minimal in-memory mock of the `chrome.*` extension APIs this package uses:
 * `storage.local`, `storage.sync`, `runtime.getManifest`, and
 * `runtime.onMessage`. Installed on `globalThis.chrome` by tests via
 * `installChromeMock()`.
 */
export function createStorageArea() {
  let store: Record<string, unknown> = {};

  return {
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
      if (keys == null) return { ...store };

      if (typeof keys === "string") {
        return keys in store ? { [keys]: store[keys] } : {};
      }

      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const key of keys) if (key in store) result[key] = store[key];
        return result;
      }

      // Object form: keys are defaults, returned when the stored key is absent.
      const result: Record<string, unknown> = {};
      for (const [key, defaultValue] of Object.entries(keys)) {
        result[key] = key in store ? store[key] : defaultValue;
      }
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      store = { ...store, ...items };
    }),
    clear: vi.fn(async () => {
      store = {};
    }),
    _dump: () => ({ ...store }),
  };
}

export function installChromeMock(manifestVersion = "0.0.0") {
  const local = createStorageArea();
  const sync = createStorageArea();
  const messageListeners: Array<
    (
      message: unknown,
      sender: unknown,
      sendResponse: (response: unknown) => void,
    ) => boolean | undefined
  > = [];

  const chromeMock = {
    storage: { local, sync },
    runtime: {
      getManifest: vi.fn(() => ({ version: manifestVersion })),
      onMessage: {
        addListener: vi.fn((listener: (typeof messageListeners)[number]) => {
          messageListeners.push(listener);
        }),
      },
    },
  };

  (globalThis as { chrome?: unknown }).chrome = chromeMock;

  return { chromeMock, local, sync, messageListeners };
}
