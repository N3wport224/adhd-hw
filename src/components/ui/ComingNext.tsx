import { Card, CardTitle } from "@/components/ui/Card";

interface ComingNextProps {
  title: string;
  intro: string;
  /** What this screen will do, in the order it is being built. */
  items: string[];
}

/**
 * Placeholder for a section whose route and navigation exist but whose
 * behaviour lands in a later pass. It says plainly what is not built yet
 * rather than showing a shell that looks interactive and is not.
 */
export function ComingNext({ title, intro, items }: ComingNextProps) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-prose text-[var(--color-ink-muted)]">{intro}</p>
      </header>

      <Card className="space-y-4">
        <CardTitle>Being built next</CardTitle>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item} className="flex gap-3 text-[var(--color-ink-muted)]">
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
