"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a ref pointing at the newest value without reading or writing it
 * during render.
 *
 * Used for values that callbacks and timers need to see fresh — playback
 * rate, the current sentence list — but that should not be dependencies of
 * those callbacks. Rebuilding a `useCallback` on every rate change would
 * restart the utterance it is in the middle of speaking.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
