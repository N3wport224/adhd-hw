"use client";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { Sentence } from "@/lib/documents/sentences";

interface KeepNoteDialogProps {
  open: boolean;
  sentence: Sentence | null;
  onClose(): void;
  onSave(comment: string): void;
}

/**
 * Keeping a passage, with room to say why.
 *
 * The comment is optional on purpose. A bare highlight is a note — asking for
 * a thought before you are allowed to mark something is how highlighting
 * stops happening.
 */
export function KeepNoteDialog({ open, sentence, onClose, onSave }: KeepNoteDialogProps) {
  return (
    <Dialog open={open} title="Keep this" description="Marked in the text, and kept with the reading." onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          const comment = new FormData(event.currentTarget).get("comment");
          onSave(String(comment ?? "").trim());
        }}
      >
        <blockquote className="rounded-xl border-l-4 border-[var(--color-accent)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm">
          {sentence?.text}
        </blockquote>

        <div className="space-y-2">
          <label htmlFor="note-comment" className="block text-sm font-medium">
            What did you make of it?
          </label>
          <textarea
            id="note-comment"
            name="comment"
            rows={3}
            placeholder="Optional — a highlight on its own is worth keeping."
            className="w-full rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary">
            Keep it
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
