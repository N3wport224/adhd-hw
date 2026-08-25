import { COURSE_ICONS } from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import type { CourseIconKey } from "@/types";

interface CourseIconProps {
  icon: CourseIconKey;
  className?: string;
}

export function CourseIcon({ icon, className }: CourseIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-5", className)}
    >
      <path d={COURSE_ICONS[icon].path} />
    </svg>
  );
}
