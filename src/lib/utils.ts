/** Joins class names, dropping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole days from today to `iso`. Negative means overdue. */
export function daysUntil(iso: string, now = new Date()) {
  const target = startOfDay(new Date(iso)).getTime();
  const today = startOfDay(now).getTime();
  return Math.round((target - today) / 86_400_000);
}

/**
 * Deliberately vague for anything past this week — precise countdowns on
 * far-off work are a source of background dread rather than useful signal.
 */
export function describeDueDate(iso: string | null, now = new Date()) {
  if (!iso) return "No due date";
  const days = daysUntil(iso, now);
  if (days < -1) return `${Math.abs(days)} days late`;
  if (days === -1) return "Due yesterday";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 6) {
    return `Due ${new Date(iso).toLocaleDateString(undefined, { weekday: "long" })}`;
  }
  return `Due ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * A plural that reads like English for the words this app actually counts.
 *
 * Not a general pluraliser — a naive "+ s" gave "5 × Quizs" on a real import,
 * which is the sort of thing that makes a screen look untended.
 */
export function plural(word: string, count: number): string {
  if (count === 1) return word;

  const head = word.slice(0, -1);
  const last = word.slice(-1).toLowerCase();
  const lower = word.toLowerCase();

  if (/(s|x|z|ch|sh)$/i.test(word)) {
    // "Quiz" doubles before the ending; "Boards" is already plural.
    if (lower.endsWith("s")) return word;
    return /[aeiou]z$/i.test(word) ? `${word}${last}es` : `${word}es`;
  }
  if (/[^aeiou]y$/i.test(word)) return `${head}ies`;
  return `${word}s`;
}

/**
 * The inverse of `plural`, for comparing a task against a grading category.
 * "Quizzes" and "Quiz 7" have to meet somewhere, and they meet here.
 */
export function singular(word: string): string {
  const lower = word.toLowerCase();
  if (/[^aeiou]ies$/.test(lower)) return `${lower.slice(0, -3)}y`;
  if (/(?:ss|sh|ch|x|z)es$/.test(lower)) {
    const base = lower.slice(0, -2);
    // "quizzes" loses the doubled letter that the plural added.
    return /([^aeiou])\1$/.test(base) ? base.slice(0, -1) : base;
  }
  if (/[^s]s$/.test(lower)) return lower.slice(0, -1);
  return lower;
}
