# Steady

A calm study and course companion for college students with ADHD. The guiding
constraint: **the app should never show you everything at once.**

Everything runs in the browser. Documents are parsed on the device and never
uploaded anywhere.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # eslint
npm run typecheck
npm test         # node:test — sentence splitting, PDF line merging, breakdown
```

## What it does

**Courses** (`/courses`) — add, edit and delete courses with a colour and
icon. Each course has a detail page holding its tasks, its syllabus, and its
readings.

**Documents** — drag and drop `.pdf`, `.docx`, `.txt` or `.md` onto a course
page and the file is bound to that course as it is parsed. Text extraction is
client-side: `pdfjs-dist` for PDFs (rejoining lines that wrapped at the page
margin), `mammoth` for Word, a plain read for text. The library at `/reader`
groups everything by course and filters by course, file type and sort order;
any row can be refiled into a different course without leaving the page.

**Read-aloud reader** (`/reader/[id]`) — a distraction-free pane with play,
pause, stop, sentence skip and 0.75×–2× speed, built on `speechSynthesis`.
The sentence being spoken is highlighted, the word within it is underlined
where the browser reports boundary events, and the page follows along. Click
any sentence to read from there. Your position is remembered per document.

**Tasks** (`/tasks`) — the full list, grouped by when work is due, with
anything past this week collapsed. "Break into steps" turns an assignment
into micro-steps from a template matched to its title; the steps are editable
before they are added, and the first unfinished one is the only one
emphasised.

**Focus mode** — from the Focus dashboard, one task fills the screen with its
next step and a Pomodoro timer, and nothing else. Completed focus blocks are
counted against the task.

**Throughout** — dark/light mode applied before first paint, keyboard support
everywhere, motion that respects `prefers-reduced-motion`, and persistence in
IndexedDB behind a `DataStore` interface.

## File tree

```
adhd-hw/
└── src/
    ├── app/
    │   ├── layout.tsx                  # providers + AppShell
    │   ├── globals.css                 # design tokens, base styles, animations
    │   ├── page.tsx                    # Focus dashboard
    │   ├── courses/[courseId]/page.tsx
    │   ├── reader/page.tsx             # library
    │   ├── reader/[documentId]/page.tsx
    │   └── tasks/page.tsx
    ├── components/
    │   ├── layout/                     # AppShell, Sidebar, TopBar, drawer,
    │   │                               #   ThemeToggle, SaveErrorBanner
    │   ├── courses/                    # CourseCard/Detail/FormDialog/Grid/Icon
    │   ├── documents/                  # DocumentDropzone, DocumentRow, LibraryView
    │   ├── reader/                     # ReaderView, ReaderControls, ReaderPane
    │   ├── tasks/                      # TasksView, TaskCard, SubtaskList,
    │   │                               #   BreakdownDialog
    │   ├── focus/                      # FocusView, FocusMode, PomodoroTimer,
    │   │                               #   QuickAddTask, TaskRow
    │   └── ui/                         # Button, Card, Dialog, Field, EmptyState
    ├── lib/
    │   ├── appData.tsx                 # context + reducers over AppData
    │   ├── storage.ts                  # DataStore interface, IndexedDB adapter
    │   ├── speech.ts                   # useSpeechReader — the TTS controller
    │   ├── pomodoro.ts                 # usePomodoro
    │   ├── taskBreakdown.ts            # assignment-shape templates
    │   ├── documents/extract.ts        # PDF / DOCX / text extraction
    │   ├── documents/sentences.ts      # the sentence splitter
    │   ├── theme.tsx, courseStyles.ts, utils.ts, useLatestRef.ts
    │   └── **/__tests__/               # node:test suites for the pure logic
    └── types/index.ts
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
- **Never put two competing utilities of the same kind in one class string.**
  `w-full` plus `w-auto`, or `p-6` plus `py-2`, resolve by stylesheet order
  rather than by which was written last. `controlClass(size)` and `Card`'s
  `padded` prop exist so callers choose once instead of overriding.
- **The reader speaks one sentence per utterance.** Speaking a whole document
  as a single utterance would be less code, but browsers report almost nothing
  about their progress through one and Chrome truncates long utterances after
  about fifteen seconds. Per-sentence utterances give exact highlighting,
  working skip controls, and a natural resume point on every browser.
- **Sentence indices are derived, never stored.** One splitter owns the
  numbering, so a saved resume position always means the same place in the
  text.
- **Storage is IndexedDB, not localStorage.** A term of extracted PDF text
  runs to megabytes; localStorage's ~5MB budget would start rejecting uploads
  first. Existing localStorage data is migrated on first load, and a failed
  write surfaces as a banner rather than being swallowed.

## Known limits

- **Scanned PDFs have no text layer.** They are rejected with a message
  saying so rather than opening an empty reader; OCR is not implemented.
- **PDF paragraph boundaries are approximate.** Wrapped lines are rejoined by
  punctuation and length, since PDFs record positioned text runs rather than
  paragraphs. Sentences are always intact, so this only affects where the
  visual paragraph breaks fall.
- **Syllabus dates are not extracted yet.** Uploading a syllabus files and
  reads it; it does not populate the schedule. That is the next piece.
- **Speech quality is the platform's.** The Web Speech API uses whatever
  voices the operating system provides, and boundary events (the word-level
  underline) are only reliable in Chromium.

## Next up

1. Parsing dates and grading breakdowns out of an uploaded syllabus to
   populate the schedule.
2. A week view built on the extracted dates.
3. A Supabase `DataStore` adapter plus auth, so data follows the student
   across devices.
