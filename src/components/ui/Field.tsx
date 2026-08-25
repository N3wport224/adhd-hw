"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

const CONTROL_CLASS = cn(
  "w-full rounded-xl border border-[var(--color-border-soft)]",
  "bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-ink)]",
  "placeholder:text-[var(--color-ink-muted)] transition",
  "focus:border-[var(--color-focus)]",
);

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
      {children({ id, className: CONTROL_CLASS })}
      {hint ? (
        <p className="text-sm text-[var(--color-ink-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export { CONTROL_CLASS };
