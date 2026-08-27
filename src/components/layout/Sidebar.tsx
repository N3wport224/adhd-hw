"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppData } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import { CourseIcon } from "@/components/courses/CourseIcon";
import { NAV_ITEMS, isActivePath } from "@/components/layout/navigation";

interface SidebarProps {
  /** Called after any navigation, so the mobile drawer can close itself. */
  onNavigate?(): void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { data, ready } = useAppData();

  // The sidebar shows a handful of courses at most. The full list lives on
  // /courses; a scrolling wall of classes in the chrome is the kind of
  // background noise this app is trying to remove.
  const pinnedCourses = data.courses.slice(0, 5);

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-8 p-5">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl px-2 py-1"
      >
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-xl bg-[var(--color-accent)] text-base font-semibold text-[var(--color-on-accent)]"
        >
          ◎
        </span>
        <span className="text-base font-semibold tracking-tight">Steady</span>
      </Link>

      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                  active
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                    : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="size-5 shrink-0"
                >
                  <path d={item.iconPath} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {ready && pinnedCourses.length > 0 ? (
        <div className="space-y-2">
          <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Courses
          </h2>
          <ul className="space-y-1">
            {pinnedCourses.map((course) => {
              const active = pathname === `/courses/${course.id}`;
              return (
                <li key={course.id}>
                  <Link
                    href={`/courses/${course.id}`}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition",
                      active
                        ? "bg-[var(--color-surface-muted)] text-[var(--color-ink)]"
                        : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        COURSE_COLORS[course.color].accent,
                      )}
                    />
                    <CourseIcon icon={course.icon} className="size-4 shrink-0" />
                    <span className="truncate">{course.code || course.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Settings sits below the divider rather than in the nav: the nav is
          about the work, and a settings link among it is one more thing to
          scan past every time. */}
      <div className="mt-auto space-y-2 border-t border-[var(--color-border-soft)] pt-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition",
            pathname === "/settings"
              ? "bg-[var(--color-surface-muted)] text-[var(--color-ink)]"
              : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
          )}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-5 shrink-0"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.5v2m0 15v2M4.2 7l1.7 1m12.2 8 1.7 1M2.5 12h2m15 0h2M4.2 17l1.7-1m12.2-8 1.7-1" />
          </svg>
          Settings &amp; backup
        </Link>

        <p className="px-3 text-xs leading-relaxed text-[var(--color-ink-muted)]">
          Everything is saved on this device. One small step is still a step.
        </p>
      </div>
    </nav>
  );
}
