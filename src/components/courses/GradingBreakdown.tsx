"use client";

import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import type { Course } from "@/types";

/**
 * The grading breakdown as a single proportional bar plus a legend.
 *
 * One bar rather than a row of numbers because the useful question is "which
 * of these actually moves my grade" — that is a comparison of sizes, and a
 * table of percentages makes you do that comparison in your head.
 */
export function GradingBreakdown({ course }: { course: Course }) {
  const weights = course.gradingWeights ?? [];
  if (weights.length === 0) return null;

  const total = weights.reduce((sum, weight) => sum + weight.percent, 0);
  const accent = COURSE_COLORS[course.color].accent;

  // Shades of one hue rather than a rainbow: these are parts of a whole, and
  // eight competing colours is noise in a palette chosen to be quiet. The
  // ramp stops at 0.55 rather than fading out — every segment has to stay
  // matchable to its legend dot, and the muted course colours wash out into
  // the background below about half opacity.
  const shade = (position: number) =>
    weights.length < 2 ? 1 : 1 - (position / (weights.length - 1)) * 0.45;

  return (
    <div className="space-y-4">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
        role="img"
        aria-label={`Grading breakdown: ${weights
          .map((weight) => `${weight.label} ${weight.percent}%`)
          .join(", ")}`}
      >
        {weights.map((weight, position) => (
          <span
            key={`${weight.label}-${position}`}
            className={cn("h-full", accent)}
            style={{
              width: `${(weight.percent / Math.max(total, 100)) * 100}%`,
              opacity: shade(position),
              // Adjacent shades can be close; a hairline gap keeps the
              // boundary readable without adding another colour.
              boxShadow: "1.5px 0 0 var(--color-surface)",
            }}
          />
        ))}
      </div>

      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {weights.map((weight, position) => (
          <li key={`${weight.label}-${position}`} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={cn("size-2.5 shrink-0 rounded-full", accent)}
              style={{ opacity: shade(position) }}
            />
            <span className="flex-1 truncate">{weight.label}</span>
            <span className="font-medium tabular-nums">{weight.percent}%</span>
          </li>
        ))}
      </ul>

      {Math.abs(total - 100) > 1 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          These add up to {Math.round(total * 10) / 10}%, not 100% — worth checking
          against the syllabus.
        </p>
      ) : null}
    </div>
  );
}
