"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared look for inputs and selects.
 *
 * Carries neither width nor padding by default — two competing utilities of
 * the same kind in one class string resolve by stylesheet order rather than
 * by which came last, so each is chosen here rather than overridden later.
 */
export function controlClass(size: "md" | "sm" = "md") {
  return cn(
    "rounded-xl border border-[var(--color-border-soft)]",
    "bg-[var(--color-surface)] text-[var(--color-ink)]",
    "placeholder:text-[var(--color-ink-muted)] transition",
    "focus:border-[var(--color-focus)]",
    size === "md" ? "px-4 py-3 text-base" : "min-h-10 px-3 py-2 text-sm",
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children(props: { id: string; className: string }): React.ReactNode;
}

/** Label + optional hint, wired to whatever control the caller renders. */
export function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children({ id, className: cn("w-full", controlClass()) })}
      {hint ? (
        <p className="text-sm text-[var(--color-ink-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
