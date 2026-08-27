# Steady

A calm study and course companion for college students with ADHD. The guiding
constraint: **the app should never show you everything at once.**

Everything runs in the browser. Documents are parsed on the device and never
uploaded anywhere.

## Run it

Needs **Node 20.9 or newer** (`node -v` to check).

```bash
git clone <this repo>
cd adhd-hw
npm install
npm run dev
```

Then open **http://localhost:3000**. There is no database to set up, no API key,
no `.env` file — everything runs in the browser and stores its data there.

### Try it in this order

1. **Courses → Add your first course.** Give it a name and a colour.
2. **Open the course and drop a syllabus on it** (PDF or Word). It parses, then
   opens a review panel. Check the term start date first — every bare date like
   "Oct 12" depends on it. Then *Select all* → *Add*.
3. **Schedule.** Your deadlines are now on a calendar, coloured by course. If
   the current week is empty it will point you at the next week that isn't.
4. **Library → drop in a reading**, open it, and press play. Space plays and
   pauses, arrows move a sentence, shift+arrows move a section.
5. **Tasks → Break into steps** on something due next week, and let it spread
   the steps across the days. Then look at Focus and Schedule again — today
   now has one small piece of it, with a checkbox.
6. **Focus → Start a focus session** for a Pomodoro timer on one task.
7. **Settings → Download a backup** once you have anything worth keeping.

### If something goes wrong

- **No sound in the reader.** Your browser or OS has no speech voices
  installed. Chrome on desktop is the most reliable; the pane still works for
  reading silently.
- **A PDF comes in as one wall of text.** It sets everything in one font size,
  so there are no headings to find. Word and Markdown files carry real
  structure and always come through exactly.
- **A scanned PDF is rejected.** There is no text layer in it to read. OCR it
  first.
- **Dates landed a year out.** The term start in the review panel was wrong.
  Re-scan from the document row (*Scan for dates*) with the right date.

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm start          # serve the production build
npm run check      # typecheck, lint and tests together
npm test           # node:test over the pure logic — 148 cases
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

**Read-aloud reader** (`/reader/[id]`) — a distraction-free pane that keeps
the document's own structure: headings stay headings, bullets stay bullets,
numbered lists keep their numbers. Section skip, a collapsible outline, and a
beat of silence before each heading so sections are audible as well as
visible. Play, pause, stop, sentence skip and 0.75×–2× speed, built on
`speechSynthesis`. Text size, line width, typeface and letter spacing are
adjustable next to the reading and remembered per device, and playback is
keyboard-driven: space to play or pause, arrows to move a sentence, shift and
arrows to move a section, escape to stop.
The sentence being spoken is highlighted, the word within it is underlined
where the browser reports boundary events, and the page follows along. Click
any sentence to read from there. Your position is remembered per document.

**Syllabus parsing** — uploading a document that reads like a syllabus opens a
review step rather than writing anything. It finds assignments (pairing a date
with something that sounds like a deliverable) and the grading breakdown, and
shows each row with its confidence, the date exactly as the syllabus wrote it,
and the source line it came from. Every row is editable and deletable; unsure
rows start unchecked. Confirmed rows become tasks on that course; the grading
breakdown and course details are saved to the course, and the meeting pattern
starts appearing on the calendar. Days are toggles and times are fields, so
correcting a wrong day costs one tap. Re-scanning the same document skips
what it already imported.

**Schedule** (`/schedule`) — planned steps and deadlines across all courses on
one calendar, plus the classes themselves. Steps carry their own checkbox on
the day they belong to, so you can tick one off where you read it; completed
steps stay put with a line through them rather than vanishing. Class meetings are drawn as dashed
outlines rather than filled chips: a lecture is where you will be, not
something to tick off. They repeat only inside the term, and can be switched
off. Week view is the default because a week is the span you can act
on; month view is there for orientation. Colour is the course. Selecting a day
opens its full list with working checkboxes, and when the visible span is
empty it names the next day that has work rather than showing a blank grid
that looks like a broken import.

**Tasks** (`/tasks`) — the full list, grouped by when work is due, with
anything past this week collapsed. "Break into steps" turns an assignment
into micro-steps from a template matched to its title, then **spreads those
steps across the days before it is due** — one, two or three a day, weekends
optional. A deadline says when work is finished and nothing about when to
start, which is how a week of runway becomes one bad Thursday night. Each
step gets its own day, so a chapter due Friday puts something small on today.
Steps already written can be spread the same way, and any single step's day
can be changed by hand.

**Focus mode** — from the Focus dashboard, one task fills the screen with its
next step and a Pomodoro timer, and nothing else. Completed focus blocks are
counted against the task.

**Settings & backup** (`/settings`) — download everything as a JSON file and
import it back. Importing adds to what is there and skips anything already
present, so importing the same file twice is safe. Also asks the browser for
durable storage, which is what stops it clearing your data to make room for
other sites.

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
    │   ├── schedule/page.tsx
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
    │   ├── reader/                     # ReaderView, ReaderControls, ReaderPane,
    │   │                               #   ReaderSettingsPanel
    │   ├── settings/                   # SettingsView
    │   ├── schedule/                   # ScheduleView, WeekGrid, MonthGrid,
    │   │                               #   DayPanel, TaskChip
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
    │   ├── syllabusCourseInfo.ts       # instructor, meeting times, office hours
    │   ├── schedule.ts                 # calendar grids, local-day grouping
    │   ├── stepPlanner.ts              # spreading steps across the days left
    │   ├── documents/extract.ts        # PDF / DOCX / text extraction
    │   ├── documents/blocks.ts         # headings, lists and quotes from each format
    │   ├── readerSettings.ts           # per-device reading comfort settings
    │   ├── backup.ts                   # export, import and merge
    │   ├── storagePersistence.ts       # durable-storage request and usage
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
- **Reading settings live next to the reading, not on a settings page.** The
  right size and measure depend on the document and on how tired you are; a
  preference you have to leave the page to change is one nobody changes.
- **Structure is captured at extraction, not guessed at render.** Word knows
  its own headings and lists, Markdown marks them, and a PDF knows only that
  some glyphs are bigger than others — so each format is brought to the same
  block shape once, on import. Flattening everything to strings was what made
  the reader a wall of uniform text.
- **PDF heading thresholds are deliberately conservative.** A paragraph
  wrongly promoted to a heading is jarring and corrupts the outline; a
  heading left as a paragraph merely looks plain.
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
- **Class meetings are a rule, not rows.** A weekly class is computed from a
  pattern and the term bounds at render time. Expanding it into a record per
  week would put hundreds of near-identical rows in storage, all needing
  revision the moment a room changes.
- **A meridiem carries forward, never back.** "11:00 to 1:00pm" starts in the
  morning; borrowing the pm would move it to eleven at night. "2-4pm" is the
  exception and is handled by plausibility — no class starts at two in the
  morning.
- **Assignment titles are taken from before the date, not by cutting the date
  out.** "Midterm 1 will be held on 10/07 in the usual room" splices badly;
  everything before the date is the name, everything after it is circumstance.
- **Steps are spread across the window, not packed against the start.** The
  point is a little every day, not a burst now and nothing after — and
  spreading leaves the last day or two clear, which is the buffer that lets a
  deadline survive one bad evening.
- **A completed step stays where it was, struck through.** Making it vanish
  the instant you succeed takes the moment away, and leaves no evidence the
  day went well.
- **The calendar groups by local day, never by UTC day.** A due date is
  stored as the instant of local midnight on the day the student picked, so
  grouping by UTC would shift half a term one square left for anyone west of
  Greenwich.
- **Never ask `toLocaleDateString` for a partial format.** A day and a year
  with no month is not a format any locale defines, and browsers answer it
  with a debug string ("2026 (day: 12)"). Assemble headings from whole
  formats instead.
- **Imported records always get fresh ids.** A backup taken on this device
  can be imported back into it without colliding with what it was taken from,
  and matching records are skipped rather than duplicated — so importing
  twice leaves you where importing once did.
- **A refused import changes nothing.** The parser is strict on purpose:
  half-applying a file it does not understand, over a term's work, is worse
  than declining it.
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
- **There is no sync and no account.** Data lives in one browser on one
  device. The backup file is the only way to move it or keep it safe.
- **Class meetings appear in week view only.** Three classes meeting three
  times a week would bury the deadlines a month grid exists to show.
- **One meeting pattern per course.** A class with a separate lab or section
  at a different time needs the second one added by hand.
- **Slash dates are read US-style.** "10/12" is October 12 unless the first
  number is above 12, in which case it can only be a day.
- **Scanned PDFs have no text layer.** They are rejected with a message
  saying so rather than opening an empty reader; OCR is not implemented.
- **PDF structure is inferred from font size.** PDFs record positioned glyphs,
  not documents, so a heading is recognised by being larger than the body
  text. A document that sets everything in one size gives up its headings,
  and wrapped lines are rejoined by punctuation and length. Word and Markdown
  files carry real structure and are read exactly.
- **Speech quality is the platform's.** The Web Speech API uses whatever
  voices the operating system provides, and boundary events (the word-level
  underline) are only reliable in Chromium.

## Next up

1. Recurring items, so "problem set due every Friday" becomes twelve tasks
   rather than one.
2. Separate lab and section times per course.
3. A Supabase `DataStore` adapter plus auth, so data follows the student
   across devices.
