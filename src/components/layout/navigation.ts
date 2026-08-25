/** Single source of truth for the nav shell, shared by sidebar and mobile bar. */
export interface NavItem {
  href: string;
  label: string;
  /** One line of plain-language purpose, shown as the section subtitle. */
  blurb: string;
  iconPath: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Focus",
    blurb: "Just the next thing to do.",
    iconPath: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  },
  {
    href: "/courses",
    label: "Courses",
    blurb: "Your classes, syllabi and materials.",
    iconPath: "M6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3Zm0 13H19M8 7h7",
  },
  {
    href: "/schedule",
    label: "Schedule",
    blurb: "Everything due, week by week.",
    iconPath:
      "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm0 4h16M8 3v4m8-4v4",
  },
  {
    href: "/tasks",
    label: "Tasks",
    blurb: "Assignments, split into small steps.",
    iconPath: "M4 6h16M4 12h16M4 18h10M2 6l0 0m0 6 0 0m0 6 0 0",
  },
  {
    href: "/reader",
    label: "Library",
    blurb: "Readings, out loud, at your pace.",
    iconPath:
      "M12 7c-2-1.6-4.4-2-7-2v13c2.6 0 5 .4 7 2m0-13c2-1.6 4.4-2 7-2v13c-2.6 0-5 .4-7 2m0-13v13",
  },
];

/** Matches nested routes (/courses/abc) to their top-level nav item. */
export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
