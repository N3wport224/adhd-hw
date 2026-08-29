"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { SaveErrorBanner } from "@/components/layout/SaveErrorBanner";
import { ReminderWatch } from "@/components/layout/ReminderWatch";
import { UndoBanner } from "@/components/layout/UndoBanner";
import { CommandPalette } from "@/components/layout/CommandPalette";

/**
 * The persistent frame every screen renders inside: a fixed sidebar on large
 * viewports, a drawer below that, one quiet header, and a single centred
 * content column.
 *
 * The column is capped at ~72rem on purpose. Full-bleed dashboards invite
 * dense multi-column layouts, and a wall of simultaneous information is the
 * exact failure mode this app is built to avoid.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const [drawerPath, setDrawerPath] = useState(pathname);

  // Any route change closes the drawer, including browser back/forward. Doing
  // it during render rather than in an effect means the drawer is already gone
  // on the first paint of the new page.
  if (pathname !== drawerPath) {
    setDrawerPath(pathname);
    setMenuOpen(false);
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <ReminderWatch />
      <CommandPalette />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[var(--color-surface)] focus:px-4 focus:py-3 focus:shadow-lg"
      >
        Skip to content
      </a>

      <aside className="hidden border-r border-[var(--color-border-soft)] bg-[var(--color-surface)] lg:block">
        <div className="sticky top-0 h-dvh overflow-y-auto">
          <Sidebar />
        </div>
      </aside>

      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-col">
        <TopBar onOpenMenu={() => setMenuOpen(true)} />
        <SaveErrorBanner />
        <UndoBanner />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 lg:px-10 lg:py-12"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
