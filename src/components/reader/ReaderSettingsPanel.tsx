"use client";

import {
  LINE_WIDTHS,
  LINE_WIDTH_LABELS,
  TEXT_SIZES,
  TEXT_SIZE_LABELS,
  TYPEFACES,
  TYPEFACE_LABELS,
  type ReaderSettings,
} from "@/lib/readerSettings";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { cn } from "@/lib/utils";

interface ReaderSettingsPanelProps {
  settings: ReaderSettings;
  onChange(patch: Partial<ReaderSettings>): void;
  onReset(): void;
}

function Choice<T extends string>({
  legend,
  options,
  labels,
  value,
  onSelect,
}: {
  legend: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onSelect(next: T): void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span aria-hidden="true" className="w-20 text-sm text-[var(--color-ink-muted)]">
        {legend}
      </span>
      <ChoiceGroup
        label={legend}
        choices={options.map((option) => ({ value: option, label: labels[option] }))}
        value={value}
        onSelect={onSelect}
        className="flex flex-wrap gap-1"
        optionClassName={(selected) =>
          cn(
            "min-h-9 rounded-lg px-3 text-sm font-medium transition",
            selected
              ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
              : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
          )
        }
      />
    </div>
  );
}

/**
 * How the text is set, rather than what it says.
 *
 * These belong next to the reading, not behind a global settings page: the
 * right size and measure depend on the document and on how tired you are,
 * and a preference you have to leave the page to change is one nobody
 * changes.
 */
export function ReaderSettingsPanel({
  settings,
  onChange,
  onReset,
}: ReaderSettingsPanelProps) {
  return (
    <div className="space-y-3 border-t border-[var(--color-border-soft)] px-5 py-4">
      <Choice
        legend="Size"
        options={TEXT_SIZES}
        labels={TEXT_SIZE_LABELS}
        value={settings.textSize}
        onSelect={(textSize) => onChange({ textSize })}
      />
      <Choice
        legend="Width"
        options={LINE_WIDTHS}
        labels={LINE_WIDTH_LABELS}
        value={settings.lineWidth}
        onSelect={(lineWidth) => onChange({ lineWidth })}
      />
      <Choice
        legend="Typeface"
        options={TYPEFACES}
        labels={TYPEFACE_LABELS}
        value={settings.typeface}
        onSelect={(typeface) => onChange({ typeface })}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.looseSpacing}
            onChange={() => onChange({ looseSpacing: !settings.looseSpacing })}
            className="size-4 accent-[var(--color-accent)]"
          />
          Extra letter spacing
        </label>
        <button
          type="button"
          onClick={onReset}
          className="ml-auto min-h-9 rounded-lg px-3 text-sm text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
