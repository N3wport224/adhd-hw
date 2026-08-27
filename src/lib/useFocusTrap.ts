"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Where focus goes when the thing that opened the overlay is gone. */
const FALLBACK = "main-content";

function isVisible(element: HTMLElement) {
  return element.getClientRects().length > 0;
}

/**
 * Focus behaviour shared by every overlay: focus moves in on open, Tab is
 * kept inside, Escape closes, and focus comes back where it started on close.
 *
 * The "where it started" part needs a fallback. Opening the add-course dialog
 * from the empty state destroys that button — once a course exists the empty
 * state is gone — and focusing a detached node silently drops focus onto
 * `<body>`, which leaves a keyboard user back at the top of the document with
 * no indication of where they are. When the opener has left, focus goes to
 * the main region instead.
 */
export function useFocusTrap(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        isVisible,
      );

    focusables()[0]?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      // Keep Tab inside the overlay so keyboard users can't wander into the
      // page behind it.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!containerRef.current?.contains(active)) {
        // Focus escaped some other way — a click on the backdrop, a control
        // that unmounted. Pull it back rather than leaving it behind the
        // overlay.
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;

      if (opener && document.contains(opener) && isVisible(opener)) opener.focus();
      else document.getElementById(FALLBACK)?.focus();
    };
  }, [open, onClose, containerRef]);
}
