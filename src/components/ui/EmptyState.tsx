import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Empty states carry the encouraging tone the rest of the app uses — an
 * empty list should read as "nothing to worry about", not as a failure.
 */
export function EmptyState({ title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-soft)]",
        "bg-[var(--color-surface)] px-6 py-12 text-center",
        className,
      )}
    >
      <p className="text-base font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-ink-muted)]">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
