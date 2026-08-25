"use client";

import { useEffect, useRef } from "react";
import { groupByParagraph, type Sentence } from "@/lib/documents/sentences";
import {
  LINE_WIDTH_CLASS,
  TEXT_SIZE_CLASS,
  TYPEFACE_CLASS,
  type ReaderSettings,
} from "@/lib/readerSettings";
import { cn } from "@/lib/utils";
import type { DocumentBlock } from "@/types";

interface ReaderPaneProps {
  blocks: DocumentBlock[];
  sentences: Sentence[];
  activeIndex: number;
  /** Character offset inside the active sentence, when the browser reports it. */
  charIndex: number | null;
  speaking: boolean;
  onSelectSentence(index: number): void;
  settings: ReaderSettings;
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

const HEADING_CLASS: Record<number, string> = {
  1: "mt-10 text-2xl font-semibold tracking-tight first:mt-0",
  2: "mt-8 text-xl font-semibold tracking-tight first:mt-0",
  3: "mt-6 text-lg font-semibold first:mt-0",
};

export function ReaderPane({
  blocks,
  sentences,
  activeIndex,
  charIndex,
  speaking,
  onSelectSentence,
  settings,
}: ReaderPaneProps) {
  const activeRef = useRef<HTMLSpanElement>(null);
  const groups = groupByParagraph(sentences);

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

  const renderSentences = (group: Sentence[]) =>
    group.map((sentence) => {
      const active = sentence.index === activeIndex;
      const spokenWord = active ? splitAtWord(sentence.text, charIndex) : null;

      return (
        // A span, not a button. Chromium forces buttons to `inline-block`,
        // which puts every sentence on its own line and stops the pane
        // reading like prose. Clicking is a pointer shortcut for jumping; the
        // keyboard equivalent is the skip controls above, which is far better
        // than tabbing through several hundred sentences to reach one.
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
              {/* `mark` defaults to a bright yellow that fights the calm palette. */}
              <mark className="rounded-sm bg-transparent font-semibold text-[var(--color-ink)] underline decoration-[var(--color-accent)] decoration-2 underline-offset-4">
                {spokenWord.word}
              </mark>
              {spokenWord.after}
            </>
          ) : (
            sentence.text
          )}{" "}
        </span>
      );
    });

  return (
    <article
      // Announced as a whole rather than sentence by sentence: a live region
      // here would make a screen reader fight the speech synthesiser.
      aria-label="Document text"
      className={cn(
        "mx-auto leading-[1.85]",
        LINE_WIDTH_CLASS[settings.lineWidth],
        TEXT_SIZE_CLASS[settings.textSize],
        TYPEFACE_CLASS[settings.typeface],
        settings.looseSpacing && "tracking-wide [word-spacing:0.16em]",
      )}
    >
      {groups.map((group) => {
        // Sentences are numbered per block, so a group's paragraph index is
        // the index of the block it came from.
        const block = blocks[group[0].paragraphIndex];
        const kind = block?.kind ?? "paragraph";
        const children = renderSentences(group);
        const key = group[0].index;

        if (kind === "heading") {
          const level = Math.min(Math.max(block?.level ?? 3, 1), 3);
          const Tag = (["h2", "h3", "h4"] as const)[level - 1];
          return (
            <Tag
              key={key}
              id={`block-${group[0].paragraphIndex}`}
              className={cn(HEADING_CLASS[level], "scroll-mt-40 leading-snug")}
            >
              {children}
            </Tag>
          );
        }

        if (kind === "listItem") {
          return (
            <div key={key} className="mt-2 flex gap-3 pl-1 first:mt-0">
              <span
                aria-hidden="true"
                className="shrink-0 select-none pt-0.5 text-[var(--color-ink-muted)] tabular-nums"
              >
                {block?.marker ?? "•"}
              </span>
              <div className="flex-1">{children}</div>
            </div>
          );
        }

        if (kind === "quote") {
          return (
            <blockquote
              key={key}
              className="mt-6 border-l-2 border-[var(--color-border-soft)] pl-4 italic text-[var(--color-ink-muted)] first:mt-0"
            >
              {children}
            </blockquote>
          );
        }

        return (
          <p key={key} className="mt-6 first:mt-0">
            {children}
          </p>
        );
      })}
    </article>
  );
}
