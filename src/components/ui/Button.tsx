"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-white hover:brightness-110 active:brightness-95",
  secondary:
    "bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border-soft)] hover:bg-[var(--color-surface-muted)]",
  ghost:
    "bg-transparent text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
  danger:
    "bg-transparent text-[#a8503f] border border-[#e2b3a9] hover:bg-[#f6e9e6] dark:text-[#e29b8b] dark:border-[#5c3a33] dark:hover:bg-[#3a2925]",
};

// Comfortably above the 44px touch-target guideline: buttons here are meant to
// be easy to hit without aiming.
const SIZES: Record<Size, string> = {
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-13 px-6 text-base",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

interface LinkButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  href: string;
}

/** Same look as Button, for things that are genuinely navigation. */
export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
