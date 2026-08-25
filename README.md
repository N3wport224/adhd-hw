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
npm test         # node:test over the pure logic — 63 cases
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

**Syllabus parsing** — uploading a document that reads like a syllabus opens a
review step rather than writing anything. It finds assignments (pairing a date
with something that sounds like a deliverable) and the grading breakdown, and
shows each row with its confidence, the date exactly as the syllabus wrote it,
and the source line it came from. Every row is editable and deletable; unsure
rows start unchecked. Confirmed rows become tasks on that course, and the
grading breakdown is saved to the course page. Re-scanning the same document
skips what it already imported.

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
    │   ├── courses/                    # CourseCard/Detail/FormDialog/Grid/Icon,
    │   │                               #   GradingBreakdown
    │   ├── syllabus/                   # SyllabusScanner, SyllabusReviewModal
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
    │   ├── syllabusParser.ts           # assignments + grading weights from text
    │   ├── syllabusDates.ts            # date recognition, anchored to a term
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
- **Nothing parsed is written without confirmation.** The syllabus parser is
  regex and heuristics over text, not comprehension. It is wrong often enough
  that a silent import would cost someone a deadline, so its output always
  goes through the review step, every row carries a confidence, and unsure
  rows start unchecked.
- **Dates resolve against a term start, never against today.** Syllabi write
  "Oct 12" and "Week 4" with no year. A Fall syllabus saying "Jan 20" means
  the following January, and the only way to know that is the term anchor —
  which is why it is the first thing the review modal asks about.
- **Assignment titles are taken from before the date, not by cutting the date
  out.** "Midterm 1 will be held on 10/07 in the usual room" splices badly;
  everything before the date is the name, everything after it is circumstance.
- **Storage is IndexedDB, not localStorage.** A term of extracted PDF text
  runs to megabytes; localStorage's ~5MB budget would start rejecting uploads
  first. Existing localStorage data is migrated on first load, and a failed
  write surfaces as a banner rather than being swallowed.

## Known limits

- **The syllabus parser is heuristics, not understanding.** It reads the
  common shapes — a dated line naming a deliverable, a label next to a
  percentage — and will miss anything laid out as a table of images, or
  phrased unusually. The review step exists because of this, not in spite
  of it.
- **Slash dates are read US-style.** "10/12" is October 12 unless the first
  number is above 12, in which case it can only be a day.
- **Scanned PDFs have no text layer.** They are rejected with a message
  saying so rather than opening an empty reader; OCR is not implemented.
- **PDF paragraph boundaries are approximate.** Wrapped lines are rejoined by
  punctuation and length, since PDFs record positioned text runs rather than
  paragraphs. Sentences are always intact, so this only affects where the
  visual paragraph breaks fall.
- **Speech quality is the platform's.** The Web Speech API uses whatever
  voices the operating system provides, and boundary events (the word-level
  underline) are only reliable in Chromium.

## Next up

1. A week view built on the imported dates.
2. Recurring items, so "problem set due every Friday" becomes twelve tasks
   rather than one.
3. A Supabase `DataStore` adapter plus auth, so data follows the student
   across devices.
