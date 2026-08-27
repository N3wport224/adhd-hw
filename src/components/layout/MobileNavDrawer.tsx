"use client";

import { useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface MobileNavDrawerProps {
  open: boolean;
  onClose(): void;
}

export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // The drawer covers the page, so it needs the same focus handling a modal
  // gets: without it, Tab walks straight past the menu into the page behind,
  // which is invisible under the backdrop.
  useFocusTrap(open, panelRef, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close navigation menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/35"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="animate-rise-fade relative h-full w-[min(19rem,85vw)] border-r border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-xl"
      >
        <div className="absolute right-3 top-3">
          <Button
            variant="ghost"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="size-11 px-0"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              aria-hidden="true"
              className="size-5"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </Button>
        </div>
        <Sidebar onNavigate={onClose} />
      </div>
    </div>
  );
}
