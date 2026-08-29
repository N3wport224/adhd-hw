"use client";

export type PaletteMode = "search" | "capture";

/**
 * A way to open the palette from anywhere without threading a prop through
 * every screen.
 *
 * There is exactly one palette, mounted once in the shell, so a single slot
 * is the whole mechanism. It exists because a keyboard-only feature is a
 * feature nobody has: the shortcuts are the fast path, and the buttons in the
 * header are how anyone finds out they exist.
 */
let opener: ((mode: PaletteMode) => void) | null = null;

export function registerPalette(open: (mode: PaletteMode) => void) {
  opener = open;
  return () => {
    if (opener === open) opener = null;
  };
}

export function openPalette(mode: PaletteMode) {
  opener?.(mode);
}
