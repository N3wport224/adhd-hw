"use client";

import { useRef } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** "wide" is for review tables, which need room for a title and a date side by side. */
  size?: "default" | "wide";
  onClose(): void;
  children: React.ReactNode;
}

/**
 * Modal built on <dialog>-like semantics without the native element, so the
 * backdrop, scroll lock and focus behaviour stay consistent across browsers.
 */
export function Dialog({
  open,
  title,
  description,
  size = "default",
  onClose,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, panelRef, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      {/* Out of the tab order on purpose: a full-screen invisible button is a
          focus stop with nothing to see, and Escape already closes. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "animate-rise-fade relative w-full overflow-y-auto",
          size === "wide" ? "max-w-3xl" : "max-w-lg",
          "max-h-[90vh] rounded-t-[var(--radius-card)] sm:rounded-[var(--radius-card)]",
          "border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6 shadow-xl",
        )}
      >
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{description}</p>
        ) : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
