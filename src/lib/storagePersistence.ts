"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Whether the browser has promised to keep this app's data.
 *
 * By default a browser may evict IndexedDB under storage pressure without
 * asking. `navigator.storage.persist()` upgrades that to durable storage —
 * the single cheapest thing that stops a term's work disappearing.
 */

export interface StorageState {
  supported: boolean;
  persisted: boolean;
  /** Bytes this origin is currently using, when the browser will say. */
  usage: number | null;
  quota: number | null;
}

const UNSUPPORTED: StorageState = {
  supported: false,
  persisted: false,
  usage: null,
  quota: null,
};

async function readState(): Promise<StorageState> {
  if (typeof navigator === "undefined" || !navigator.storage) return UNSUPPORTED;

  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  let usage: number | null = null;
  let quota: number | null = null;

  if (navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usage = estimate.usage ?? null;
      quota = estimate.quota ?? null;
    } catch {
      // Estimates are advisory; failing to get one is not worth reporting.
    }
  }

  return { supported: typeof navigator.storage.persist === "function", persisted, usage, quota };
}

export function useStoragePersistence() {
  const [state, setState] = useState<StorageState>(UNSUPPORTED);
  const [asking, setAsking] = useState(false);

  const refresh = useCallback(async () => {
    setState(await readState());
  }, []);

  useEffect(() => {
    let active = true;
    readState().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const requestPersistence = useCallback(async () => {
    if (!navigator.storage?.persist) return;
    setAsking(true);
    try {
      await navigator.storage.persist();
    } catch {
      // Some browsers reject outright rather than returning false.
    } finally {
      setAsking(false);
      await refresh();
    }
  }, [refresh]);

  return { state, asking, requestPersistence, refresh };
}
