import type { CourseColorKey, CourseIconKey } from "@/types";

/**
 * Muted, high-contrast course colours. Each entry ships light and dark
 * variants so a course reads the same in either theme without shouting.
 */
export const COURSE_COLORS: Record<
  CourseColorKey,
  { label: string; swatch: string; chip: string; accent: string }
> = {
  sage: {
    label: "Sage",
    swatch: "bg-[#7f9c86]",
    chip: "bg-[#e8efe9] text-[#33513e] dark:bg-[#26362c] dark:text-[#bdd6c5]",
    accent: "bg-[#7f9c86]",
  },
  sky: {
    label: "Sky",
    swatch: "bg-[#7d9dc4]",
    chip: "bg-[#e6edf6] text-[#33506f] dark:bg-[#25334a] dark:text-[#bed3ec]",
    accent: "bg-[#7d9dc4]",
  },
  lavender: {
    label: "Lavender",
    swatch: "bg-[#9a90c4]",
    chip: "bg-[#ecebf6] text-[#4a4270] dark:bg-[#312c47] dark:text-[#cdc7ea]",
    accent: "bg-[#9a90c4]",
  },
  clay: {
    label: "Clay",
    swatch: "bg-[#b58a70]",
    chip: "bg-[#f4eae3] text-[#6b4a37] dark:bg-[#3d2f26] dark:text-[#e0c4b1]",
    accent: "bg-[#b58a70]",
  },
  amber: {
    label: "Amber",
    swatch: "bg-[#c1a15c]",
    chip: "bg-[#f6efdd] text-[#6b5626] dark:bg-[#3b3320] dark:text-[#e3d0a2]",
    accent: "bg-[#c1a15c]",
  },
  rose: {
    label: "Rose",
    swatch: "bg-[#c08592]",
    chip: "bg-[#f6e9ec] text-[#6f3f49] dark:bg-[#3d272c] dark:text-[#e6bfc7]",
    accent: "bg-[#c08592]",
  },
  teal: {
    label: "Teal",
    swatch: "bg-[#6d9fa0]",
    chip: "bg-[#e4f0f0] text-[#2f5455] dark:bg-[#22383a] dark:text-[#b4d8d9]",
    accent: "bg-[#6d9fa0]",
  },
  slate: {
    label: "Slate",
    swatch: "bg-[#8b93a3]",
    chip: "bg-[#ebedf1] text-[#42495a] dark:bg-[#2c313b] dark:text-[#c7cdd8]",
    accent: "bg-[#8b93a3]",
  },
};

export const COURSE_COLOR_KEYS = Object.keys(COURSE_COLORS) as CourseColorKey[];

/**
 * Icons are inline SVG path data so the shell has no icon-font dependency
 * and nothing flashes in on first paint.
 */
export const COURSE_ICONS: Record<CourseIconKey, { label: string; path: string }> = {
  book: {
    label: "Book",
    path: "M6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3Zm0 13H19M8 7h7",
  },
  flask: {
    label: "Science",
    path: "M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3M9 3h6M7.6 14h8.8",
  },
  calculator: {
    label: "Math",
    path: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 4h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01",
  },
  globe: {
    label: "Language",
    path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c-3 3.2-3 14.8 0 18m0-18c3 3.2 3 14.8 0 18M3.5 9h17M3.5 15h17",
  },
  palette: {
    label: "Art",
    path: "M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Zm-4.5 9.5h.01M9.5 8h.01M14.5 7.5h.01",
  },
  code: {
    label: "Computing",
    path: "m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14",
  },
  heart: {
    label: "Health",
    path: "M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7C19 15.6 12 20 12 20Z",
  },
  scale: {
    label: "Law & policy",
    path: "M12 4v16M7 20h10M5 8h14M5 8 2.5 14h5L5 8Zm14 0-2.5 6h5L19 8Z",
  },
};

export const COURSE_ICON_KEYS = Object.keys(COURSE_ICONS) as CourseIconKey[];
