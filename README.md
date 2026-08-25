# Steady

A calm study and course companion for college students with ADHD. The guiding
constraint: **the app should never show you everything at once.**

This is the first slice — project setup, the navigation shell, the Focus
dashboard, and course management. Syllabus parsing, task breakdown with a
Pomodoro timer, and the read-aloud reader come next.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # eslint
npm run typecheck
```

## What works today

- **Navigation shell** — sidebar on desktop, drawer on mobile, one quiet
  header, skip-to-content link, full keyboard support.
- **Focus dashboard** (`/`) — a single "Next up" card, an "Also today" list
  only when there is more than one thing, quick capture, and a "Done today"
  section where completions land.
- **Courses** (`/courses`) — add, edit and delete courses with a colour and
  icon; each course gets a detail page with its tasks and a quick-add.
- **Dark / light mode** — set before first paint, so there is no flash.
- **Local persistence** — everything is stored in `localStorage` behind a
  `DataStore` interface, so a Supabase adapter can be dropped in without
  touching a single component.

`/tasks` and `/reader` are routed and reachable but state plainly what is
still being built rather than showing shells that look interactive.

## File tree

```
adhd-hw/
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── src/
    ├── app/
    │   ├── layout.tsx              # root layout: providers + AppShell
    │   ├── globals.css             # design tokens, base styles, animations
    │   ├── icon.svg
    │   ├── not-found.tsx
    │   ├── page.tsx                # Focus dashboard
    │   ├── courses/
    │   │   ├── page.tsx
    │   │   └── [courseId]/page.tsx
    │   ├── reader/page.tsx
    │   └── tasks/page.tsx
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.tsx        # the main layout component
    │   │   ├── Sidebar.tsx
    │   │   ├── TopBar.tsx
    │   │   ├── MobileNavDrawer.tsx
    │   │   ├── ThemeToggle.tsx
    │   │   └── navigation.ts       # nav items, shared by sidebar + drawer
    │   ├── courses/
    │   │   ├── CourseCard.tsx
    │   │   ├── CourseDetail.tsx
    │   │   ├── CourseFormDialog.tsx
    │   │   ├── CourseGrid.tsx
    │   │   └── CourseIcon.tsx
    │   ├── focus/
    │   │   ├── FocusView.tsx
    │   │   ├── QuickAddTask.tsx
    │   │   └── TaskRow.tsx
    │   └── ui/
    │       ├── Button.tsx
    │       ├── Card.tsx
    │       ├── ComingNext.tsx
    │       ├── Dialog.tsx
    │       ├── EmptyState.tsx
    │       └── Field.tsx
    ├── lib/
    │   ├── appData.tsx             # context + reducers over AppData
    │   ├── courseStyles.ts         # course colour + icon tokens
    │   ├── storage.ts              # DataStore interface, localStorage adapter
    │   ├── theme.tsx               # dark/light, DOM as source of truth
    │   └── utils.ts
    └── types/
        └── index.ts                # Course, Task, SubTask, StudyDocument
```

## Design notes

A few decisions worth knowing before extending this:

- **Colour tokens are defined per theme, never derived with opacity
  modifiers.** Tailwind resolves something like `bg-[var(--x)]/40` to one
  theme's hex at build time, so the tint would not change in dark mode. If you
  need a tinted panel, add a token for it.
- **The `dark` class on `<html>` is the source of truth for the theme.** An
  inline script sets it before paint; React subscribes via
  `useSyncExternalStore` rather than keeping a second copy.
- **Deleting a course does not delete its work.** Tasks and documents are
  unfiled instead, so a mistaken tap is never destructive.
- **Motion is opt-out.** `prefers-reduced-motion` disables the completion
  animation and all transitions.
- **The content column is capped.** Full-bleed invites dense multi-column
  layouts, which is the failure mode this app exists to avoid.

## Next up

1. Syllabus upload (drag-and-drop) and client-side PDF/DOCX parsing to extract
   dates and grading breakdowns.
2. Task breakdown into sub-steps, with a Pomodoro timer attached to the step
   you are on.
3. The read-aloud reader: `speechSynthesis` playback at 0.75x–2x with
   sentence-level highlighting and a saved position per document.
4. A Supabase `DataStore` adapter plus auth, so data follows the student
   across devices.
