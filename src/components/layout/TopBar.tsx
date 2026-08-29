"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { EXTRA_SECTIONS, NAV_ITEMS, isActivePath } from "@/components/layout/navigation";
import { openPalette } from "@/lib/palette";

interface TopBarProps {
  onOpenMenu(): void;
}

/**
 * Names the current section and nothing else. The header is the one piece of
 * chrome on every screen, so it stays quiet.
 */
export function TopBar({ onOpenMenu }: TopBarProps) {
  const pathname = usePathname();
  const current = [...NAV_ITEMS, ...EXTRA_SECTIONS].find((item) =>
    isActivePath(pathname, item.href),
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border-soft)] bg-[var(--color-canvas)]">
      <div className="flex items-center gap-3 px-5 py-3 lg:px-10 lg:py-4">
        <Button
          variant="ghost"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="size-11 px-0 lg:hidden"
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
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </Button>

        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight">
            {current?.label ?? "Steady"}
          </h1>
          <p className="hidden truncate text-sm text-[var(--color-ink-muted)] sm:block">
            {current?.blurb ?? ""}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* The shortcuts are the fast path; these are how anyone learns the
              shortcuts exist. Both say their key out loud in the tooltip. */}
          <Button
            variant="ghost"
            onClick={() => openPalette("search")}
            aria-label="Search everything"
            title="Search everything (Ctrl or ⌘ + K)"
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
              <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            onClick={() => openPalette("capture")}
            aria-label="Park a thought"
            title="Park a thought (C)"
            className="size-11 px-0"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
