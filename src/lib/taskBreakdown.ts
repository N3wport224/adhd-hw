/**
 * Suggests micro-steps for an assignment.
 *
 * This is a template matcher, not a model — it recognises the shape of common
 * college assignments from the words in the title. That honesty matters in
 * the UI too: the steps are offered as a starting point to edit, never
 * presented as the authoritative plan.
 *
 * The first step of every template is deliberately tiny. Task paralysis is
 * rarely about the whole assignment being impossible; it is about not knowing
 * where the entry point is.
 */

export interface BreakdownTemplate {
  id: string;
  /** Shown when the user picks a template by hand. */
  label: string;
  match: RegExp;
  steps: string[];
}

const TEMPLATES: BreakdownTemplate[] = [
  {
    id: "essay",
    label: "Essay or paper",
    match: /\b(essay|paper|write|writing|report|thesis|argument|memo)\b/i,
    steps: [
      "Re-read the prompt and write down what it is actually asking",
      "Collect quotes and sources into one document",
      "Draft an outline of the main points",
      "Write the body paragraphs, worst-draft allowed",
      "Write the intro and conclusion last",
      "Read it out loud once and fix what trips you up",
      "Check the citation format and submit",
    ],
  },
  {
    id: "reading",
    label: "Reading",
    match: /\b(read|reading|chapter|ch\.?\s?\d|article|textbook|pages?|pp\.)\b/i,
    steps: [
      "Skim the headings and the summary first",
      "Read the first half",
      "Take a five-minute break",
      "Read the second half",
      "Write three sentences on what it was about",
    ],
  },
  {
    id: "problemSet",
    label: "Problem set",
    match: /\b(problem set|pset|homework|hw|exercises?|worksheet|questions?)\b/i,
    steps: [
      "Open the assignment and number the questions",
      "Do the two easiest questions first",
      "Work through the rest in order, skipping anything that stalls you",
      "Come back to the skipped ones",
      "Check your answers and submit",
    ],
  },
  {
    id: "exam",
    label: "Exam or quiz",
    match: /\b(exam|midterm|final|quiz|test|study)\b/i,
    steps: [
      "List the topics that will be covered",
      "Mark which topics you already know",
      "Make one page of notes for the shakiest topic",
      "Do practice questions on that topic",
      "Repeat for the next shakiest topic",
      "Review your notes the night before",
    ],
  },
  {
    id: "presentation",
    label: "Presentation",
    match: /\b(presentation|present|slides?|deck|talk|poster)\b/i,
    steps: [
      "Write the one sentence you want people to remember",
      "Sketch the slide order on paper",
      "Build the slides without worrying how they look",
      "Tidy the formatting",
      "Run through it out loud once, timed",
    ],
  },
  {
    id: "project",
    label: "Project or lab",
    match: /\b(project|lab|build|design|prototype|experiment|code|implement)\b/i,
    steps: [
      "Write down what 'done' looks like",
      "List the pieces it needs",
      "Build the smallest piece that works end to end",
      "Add the remaining pieces one at a time",
      "Write up the results",
      "Review the rubric and fill any gaps",
    ],
  },
];

/** Used when nothing matches — still better than a blank list. */
const GENERIC_STEPS = [
  "Open the assignment and read what is being asked",
  "Write down the very first physical action to take",
  "Do that first action",
  "Do the main body of the work",
  "Look it over once and submit",
];

export const BREAKDOWN_TEMPLATES = TEMPLATES;

export function templateForTitle(title: string): BreakdownTemplate | null {
  return TEMPLATES.find((template) => template.match.test(title)) ?? null;
}

/**
 * Micro-steps for a task title. Falls back to a generic sequence so the
 * button always produces something to react to — editing a wrong list is far
 * easier than starting from an empty one.
 */
export function suggestSteps(title: string): string[] {
  return templateForTitle(title)?.steps ?? GENERIC_STEPS;
}

export function stepsForTemplate(templateId: string): string[] {
  return TEMPLATES.find((template) => template.id === templateId)?.steps ?? GENERIC_STEPS;
}
