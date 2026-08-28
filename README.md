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
   "Oct 12" depends on it. Then *Select all* → *Add*. Leave **Add a lectures
   task for each week of term** ticked and every week of the course gets one,
   with a step on each class day.
3. **Schedule.** Your deadlines are now on a calendar, coloured by course. If
   the current week is empty it will point you at the next week that isn't.
4. **Library → drop in a reading**, open it, and press play. Space plays and
   pauses, arrows move a sentence, shift+arrows move a section.
5. **Tasks → Break into steps** on something due next week, and let it spread
   the steps across the days. Then look at Focus and Schedule again — today
   now has one small piece of it, with a checkbox.
6. **Focus → Start a focus session** for a Pomodoro timer on one task.
7. **Settings → Download a backup** once you have anything worth keeping.

### Accessibility

Audited with axe-core across every page in both themes, plus the dialogs, the
month calendar and completed work: zero violations at WCAG 2.1 AA. The colour
tokens are guarded by unit tests that compute contrast ratios from the
stylesheet itself, so a colour change that breaks a pair fails the build
rather than shipping.

Separately walked with nothing but a keyboard, which is the part axe cannot
check: every screen can be driven, and every task finished, without a pointer.

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
npm test           # node:test over the pure logic — 239 cases
```

## What it does

**Courses** (`/courses`) — add, edit and delete courses with a colour, an icon
and the term's first and last day. Each course has a detail page holding its
tasks, its syllabus, its weekly lectures and its readings.

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
where the browser reports boundary events, and the page follows along. Double-click any
sentence to read from there — deliberately two clicks, and with no hover
tint, because a pane meant to be read should not flicker under the cursor. Your position is remembered per document.

**K** keeps the sentence under the cursor, with an optional note. Reading with
the whole thing narrated is the one time you reliably notice the sentence that
matters, and the alternative was a highlight in a PDF nobody opens again — the
kept lines are listed under the document, each one a link back to where it was
said. The comment is optional on purpose: a bare highlight is a note.

**Syllabus parsing** — uploading a document that reads like a syllabus opens a
review step rather than writing anything. It finds assignments (pairing a date
with something that sounds like a deliverable) and the grading breakdown, and
shows each row with its confidence, the date exactly as the syllabus wrote it,
and the source line it came from. Every row is editable and deletable; unsure
rows start unchecked. Confirmed rows become tasks on that course; the grading
breakdown and course details are saved to the course, and the meeting pattern
starts appearing on the calendar. Anything due more than a month out starts
unticked — a term arrives as forty-odd items, and importing all of them on day
one is the wall this app exists to avoid — with one link to take the whole term
anyway. The step also opens with what the import amounts to ("13 × Quizzes, 14
× Discussion Boards"), so its shape can be checked without reading every row. Days are toggles and times are fields, so
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

**What a piece of work is worth** — a task carries the share of the final
grade it represents, worked out from the syllabus's own breakdown and split
across the items in its category, so thirteen quizzes at 13% read as 1% each
rather than 13. Shown only above 5%, where it is big enough to change what
gets dropped on a bad week; below that it is noise on a card.

**Tasks** (`/tasks`) — the full list, grouped by when work is due, with
anything past this week collapsed. "Break into steps" turns an assignment
into micro-steps from a template matched to its title, then **spreads those
steps across the days before it is due** — one, two or three a day, weekends
optional. A deadline says when work is finished and nothing about when to
start, which is how a week of runway becomes one bad Thursday night. Each
step gets its own day, so a chapter due Friday puts something small on today.
Steps already written can be spread the same way, and any single step's day
can be changed by hand. Assignments can be edited after the fact — title,
course, due date and notes — and moving a due date offers to spread the
remaining steps again, since the old days no longer fit.

**Course calendar import** — Canvas, Blackboard and Moodle all publish an
iCalendar file of every assignment and its real due date. Saving that file and
dropping it on the course reads it directly: no heuristics, and re-importing
after a deadline moves updates what is already there rather than duplicating
it, because every item carries the feed's own identifier. A downloaded file
rather than a subscribed URL — the feed address is a secret link to everything
you are enrolled in, and nothing here needs to hold one. The syllabus scan
still earns its place for what a feed does not carry: grading weights, office
hours, class times.

**Weekly lectures** — the one piece of coursework nothing writes down as a
deadline, and so the first to quietly slide. Given a term and the days a class
meets, each week of term becomes a single task ("Week 6 lectures") with a step
for each class, already carrying the day it happens. Tick one off from the
calendar, from Focus, or from the task itself. Offered as a checkbox during a
syllabus scan, and available any time from **Weekly lectures** on the course
page — including for a course with no meeting days, which gets one step a week
for watching the recordings. Adding again only fills in the weeks that are
missing, so extending a term tops it up rather than duplicating it.

**Focus mode** — from the Focus dashboard, one task fills the screen with its
next step and a timer, and nothing else. Two ways in: **Just five minutes**,
which is the on-ramp — the hard part is agreeing to begin, and a small enough
ask is one nobody argues with — or a full session. Either opens *armed* rather
than running: the clock starts on the first thing you actually do, so the two
minutes spent finding the reading are not billed to the block. Touching the
timer's own controls does not count as beginning, so the block length can be
changed before the clock moves.

The block is 5 to 50 minutes, not a fixed 25: twenty-five is a convention, not
a finding, and it is both too much to agree to on a bad day and an
interruption in the middle of a good one. At the bell the timer **asks** —
keep going, or take the break — rather than stopping you.

Pressing **C** parks a stray thought without leaving the session. An intrusive
"I need to email the TA" costs the whole sitting if acting on it means
navigating away.

Leaving asks **where did you get to?**, and the answer is shown above the next
step when the task comes back round. Asked on the way out it is still in your
head; left as an empty field on a task it would never be filled in, and coming
back four days later without it means re-deciding where to start rather than
resuming. A step planned for today that is not going to happen can be moved to
tomorrow with **Not today**, which is the honest version of leaving it to go
quietly overdue.

Time spent is recorded in minutes, and once the same kind of work has been
done twice the app can say what it typically takes — an estimate from your own
history rather than a number you guessed. Time blindness is the deficit; being
asked to estimate does not fix it.

**Knowing what a week holds** — the Focus page says when the rest of the week
is more planned work than the evenings left can hold, and sums up what the
last seven days actually produced. The planner used to spread steps without
ever saying "this is too much", which quietly confirmed an underestimate; and
nothing said what a week had produced, which matters because the feeling on a
Friday evening is "I got nothing done" almost regardless of what happened.

**Reminders** — the one part of the app that speaks first. Everything else is
pull: it works only if you remember to open it, which is asking exactly what
ADHD is worst at — prospective memory, the remembering to remember, is the
deficit. Turned on from settings, a browser notification arrives fifteen
minutes before a class, and once in the evening if the day's planned steps are
untouched, naming the first one rather than counting them: "one thing" is a
number, "read the first half" is something you can picture starting. They only
fire while a tab is open — see **Known limits**.

**Settings & backup** (`/settings`) — download everything as a JSON file and
import it back. The date of the last backup is kept per device, and after a
fortnight the settings page and the sidebar say so in words — not a badge that
never clears, which is the background dread this app exists to avoid. Importing adds to what is there and skips anything already
present, so importing the same file twice is safe. Also asks the browser for
durable storage, which is what stops it clearing your data to make room for
other sites.

**Throughout** — dark/light mode applied before first paint, motion that
respects `prefers-reduced-motion`, and persistence in IndexedDB behind a
`DataStore` interface. Every task can be completed from the keyboard alone: a
skip link, focus that is trapped inside dialogs and the mobile menu and
returns where it started when they close, one-of-several pickers as radio
groups moved with arrow keys, and a month calendar that navigates a day at a
time with the arrows and a week at a time with up and down.

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
    │   │                               #   GradingBreakdown, LecturePlanner
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
    │   └── ui/                         # Button, Card, ChoiceGroup, Dialog,
    │                                   #   Field, EmptyState
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
    │   ├── lecturePlan.ts              # a term of weekly lecture tasks
    │   ├── calendarFeed.ts             # iCalendar parsing for course feeds
    │   ├── syllabusTables.ts           # flattened table rows, put back together
    │   ├── backupReminder.ts           # when this device last backed up
    │   ├── workHistory.ts              # what this kind of work usually costs
    │   ├── weekLoad.ts                 # the week ahead, and the week behind
    │   ├── taskWeight.ts               # what a task is worth of the final grade
    │   ├── reminders.ts                # class and evening notifications
    │   ├── useFocusTrap.ts             # focus handling shared by every overlay
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
- **The accent is two tokens, not one.** A filled background that something
  legible sits on, and a text colour on pale surfaces, pull in opposite
  directions — the value light enough to read on a dark background is far too
  light to put white on. Collapsing them is how every primary button in dark
  mode ended up at 2.4:1. `--color-accent` and `--color-on-accent` are chosen
  as a pair per theme, and a unit test reads them out of the stylesheet and
  fails if any text pair drops below WCAG AA.
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
- **Class meetings are a rule, not rows — lectures to attend are rows.** The
  block drawn on the calendar is computed from the pattern and the term bounds
  at render time, because expanding it into a record per week would put
  hundreds of near-identical rows in storage, all needing revision the moment
  a room changes. The thing you tick off is different: it carries state, so it
  has to be stored. One task a week with a step per class, not one task per
  class — three sessions across five courses is fifteen list items, which is
  the wall this app exists to avoid.
- **Nothing dims live text with opacity.** Fading a whole element is the
  quickest way to put its text under 4.5:1, and it did, three times: the days
  either side of a month, the parent title under a calendar step, and a
  completed task card. Set something back with a duller ground or a smaller
  size instead. Done is not the same as unreadable.
- **An overlay's focus goes somewhere when it closes.** Focus returns to
  whatever opened it — unless that thing is gone, which happens whenever the
  empty state that held the button is replaced by the thing it created.
  Focusing a detached node silently drops focus on `<body>`, so the fallback
  is the main region, which has a focus ring for exactly this.
- **A picker with more than a few options is a radio group.** Eight colours,
  eight icons and forty-two days in a month were sixty tab stops between the
  top of a screen and the button at the bottom of it. Roving tabindex makes
  each one stop, and arrow keys the way to move inside it.
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
- **Falling behind is the ordinary case, and the app absorbs it.** Steps that
  slipped past their day are carried onto today rather than hidden, and one
  button re-spreads whatever is left over the days that remain. A plan still
  pointing at days that have gone is not a plan; it is a list of failures to
  scroll past.
- **Only a few slipped steps are shown, with the true count stated.** A bad
  week must not turn the one screen built to show a single next thing into
  the wall of everything it exists to prevent.
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
- **Documents are stored apart from everything else, and only what changed is
  written.** Courses and tasks are small and change constantly; readings are
  large and almost never change. Keeping them in one record meant ticking a
  checkbox re-serialised every reading ever imported — measured at 12ms with
  5MB of documents, 75ms at 27MB and 200ms at 71MB, growing with material
  that had nothing to do with what changed. Split into their own object
  store, with reference equality deciding which documents need writing, the
  cost is flat: about 1ms at any size.

## Known limits

- **A calendar feed is a snapshot, not a subscription.** Dropping the file in
  again is what picks up a moved deadline; nothing polls for you.
- **The syllabus parser is heuristics, not understanding.** It reads the
  common shapes — a dated line naming a deliverable, a label next to a
  percentage — and will miss anything laid out as a table of images, or
  phrased unusually. The review step exists because of this, not in spite
  of it.
- **Reminders only fire while a tab is open.** Real push would need a service
  worker and a server to push from, and this app has neither on purpose —
  everything stays on the device. A closed browser is a silent one.
- **A low-confidence row near a confident one is dropped.** "There will be a
  midterm during week 9" is a sentence about the midterm, not a second
  midterm, so an unsure row within ten days of a confident one of the same
  kind is treated as an echo of it. Where two genuinely different pieces of
  work of the same kind fall in the same fortnight and only one was written
  with a real date, the unsure one is lost — the review step shows what
  survived, and anything missing can be added by hand.
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

1. Recurring assignments, so "problem set due every Friday" becomes twelve
   tasks rather than one — the way a term of lectures already does.
2. Separate lab and section times per course.
3. A Supabase `DataStore` adapter plus auth, so data follows the student
   across devices.
