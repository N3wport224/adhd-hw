"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export interface Choice<T extends string> {
  value: T;
  /** The accessible name. Also the visible text unless `content` is given. */
  label: string;
  /** For pickers whose options are swatches or icons rather than words. */
  content?: React.ReactNode;
  /** Classes specific to this one option, such as a swatch colour. */
  className?: string;
}

interface ChoiceGroupProps<T extends string> {
  /** Names the group for screen readers. Render your own visible label beside it. */
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onSelect(next: T): void;
  className?: string;
  /** Classes for one option, given whether it is the selected one. */
  optionClassName(selected: boolean): string;
}

/**
 * One-of-several picker: speed, text size, course colour.
 *
 * Two reasons this is not a row of toggle buttons. It is a radio group, and
 * saying so lets a screen reader announce "3 of 8" instead of eight unrelated
 * pressed states. And it is a single tab stop — arrow keys move between the
 * options, the way native radios do. That matters more here than it looks:
 * the colour and icon pickers alone were sixteen tab stops standing between
 * the course name and the button that saves it.
 */
export function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  onSelect,
  className,
  optionClassName,
}: ChoiceGroupProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const selectedIndex = choices.findIndex((choice) => choice.value === value);
  // Nothing selected yet still needs one reachable stop, or the group would
  // be skipped over entirely.
  const stopIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function onKeyDown(event: React.KeyboardEvent) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;

    // Selection follows focus, so the option holding the tab stop is also the
    // one focus is on — no separate cursor to track.
    let next: number;
    if (step !== 0) {
      next = (stopIndex + step + choices.length) % choices.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = choices.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    onSelect(choices[next].value);
    groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={className}
    >
      {choices.map((choice, index) => {
        const selected = choice.value === value;
        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={choice.content === undefined ? undefined : choice.label}
            title={choice.content === undefined ? undefined : choice.label}
            tabIndex={index === stopIndex ? 0 : -1}
            onClick={() => onSelect(choice.value)}
            className={cn(optionClassName(selected), choice.className)}
          >
            {choice.content ?? choice.label}
          </button>
        );
      })}
    </div>
  );
}
