"use client";

import { useEffect, useRef } from "react";
import { groupByParagraph, type Sentence } from "@/lib/documents/sentences";
import { cn } from "@/lib/utils";

interface ReaderPaneProps {
  sentences: Sentence[];
  activeIndex: number;
  /** Character offset inside the active sentence, when the browser reports it. */
  charIndex: number | null;
  speaking: boolean;
  onSelectSentence(index: number): void;
}

/**
 * Splits the active sentence around the word currently being spoken, when the
 * browser reports boundary events. Chrome does; Firefox and Safari are
 * inconsistent, so this is strictly an enhancement on top of the sentence
 * highlight, never the thing you rely on to follow along.
 */
function splitAtWord(text: string, charIndex: number | null) {
  if (charIndex === null || charIndex < 0 || charIndex >= text.length) return null;
  const end = text.indexOf(" ", charIndex);
  return {
    before: text.slice(0, charIndex),
    word: text.slice(charIndex, end === -1 ? text.length : end),
    after: end === -1 ? "" : text.slice(end),
  };
}

export function ReaderPane({
  sentences,
  activeIndex,
  charIndex,
  speaking,
  onSelectSentence,
}: ReaderPaneProps) {
  const activeRef = useRef<HTMLSpanElement>(null);
  const paragraphs = groupByParagraph(sentences);

  /**
   * Follows the voice down the page, but only when it has to.
   *
   * `scrollIntoView` is not used here because neither of its options fits:
   * `nearest` leaves the sentence pinned to the very edge of the screen, half
   * under the sticky controls, and `center` re-centres the page on every
   * sentence, which turns the text itself into a source of motion. Instead
   * the sentence is left alone while it sits in a comfortable band, and moved
   * to roughly a third down the screen when it leaves.
   */
  useEffect(() => {
    const node = activeRef.current;
    if (!node || !speaking) return;

    const rect = node.getBoundingClientRect();
    // Clear of the sticky controls at the top and of the fold at the bottom.
    const safeTop = 160;
    const safeBottom = window.innerHeight - 96;
    if (rect.top >= safeTop && rect.bottom <= safeBottom) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: Math.max(0, window.scrollY + rect.top - window.innerHeight * 0.35),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [activeIndex, speaking]);

  return (
    <article
      // Announced as a whole rather than sentence by sentence: a live region
      // here would make a screen reader fight the speech synthesiser.
      aria-label="Document text"
      className="mx-auto max-w-[65ch] space-y-6 text-lg leading-[1.85]"
    >
      {paragraphs.map((paragraph) => (
        <p key={paragraph[0].index}>
          {paragraph.map((sentence) => {
            const active = sentence.index === activeIndex;
            const spokenWord = active ? splitAtWord(sentence.text, charIndex) : null;

            return (
              // A span, not a button. Chromium forces buttons to
              // `inline-block`, which puts every sentence on its own line and
              // stops the pane reading like prose. Clicking is a pointer
              // shortcut for jumping; the keyboard equivalent is the skip
              // controls above, which is far better than tabbing through
              // several hundred sentences to reach one.
              <span
                key={sentence.index}
                ref={active ? activeRef : undefined}
                onClick={() => onSelectSentence(sentence.index)}
                title="Read from here"
                aria-current={active ? "true" : undefined}
                className={cn(
                  "cursor-pointer rounded-md transition-colors",
                  "hover:bg-[var(--color-surface-muted)]",
                  active
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                    : "text-[var(--color-ink)]",
                )}
              >
                {spokenWord ? (
                  <>
                    {spokenWord.before}
                    <mark // `mark` defaults to a bright yellow that fights the calm palette.
                      className="rounded-sm bg-transparent font-semibold text-[var(--color-ink)] underline decoration-[var(--color-accent)] decoration-2 underline-offset-4">
                      {spokenWord.word}
                    </mark>
                    {spokenWord.after}
                  </>
                ) : (
                  sentence.text
                )}{" "}
              </span>
            );
          })}
        </p>
      ))}
    </article>
  );
}
