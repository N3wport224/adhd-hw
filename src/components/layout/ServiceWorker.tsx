"use client";

import { useEffect } from "react";

/**
 * Registers the offline worker, in production only.
 *
 * Never in development: a service worker holding onto the previous build is
 * one of the more baffling ways for a dev server to appear broken, and it
 * costs a good hour before anyone suspects it.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    // After load, so registering never competes with the first paint.
    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // A browser refusing to register still runs the app perfectly well
        // online, which is where it is nearly always used.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
