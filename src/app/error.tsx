"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, LinkButton } from "@/components/ui/Button";

/**
 * The screen a crash lands on.
 *
 * Written to answer the two questions a blank page leaves: is my work gone,
 * and what do I do now. Nothing here touches stored data, so the honest
 * answer to the first is no.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset(): void;
}) {
  useEffect(() => {
    // Nothing is reported anywhere — this app has no backend — but the
    // console is where anyone debugging their own copy will look first.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">That page stopped working</h2>
      <p className="text-[var(--color-ink-muted)]">
        Something went wrong while drawing this screen. Your courses, tasks and
        documents are stored separately and have not been touched.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <LinkButton href="/" variant="secondary">
          Back to Focus
        </LinkButton>
      </div>

      <p className="text-sm text-[var(--color-ink-muted)]">
        If it keeps happening,{" "}
        <Link href="/settings" className="underline underline-offset-4">
          download a backup
        </Link>{" "}
        so nothing is riding on this browser alone.
      </p>
    </div>
  );
}
