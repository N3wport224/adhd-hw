"use client";

import { PLAYBACK_RATES, type PlaybackRate, type SpeechReader } from "@/lib/speech";
import { cn } from "@/lib/utils";

interface ReaderControlsProps {
  reader: SpeechReader;
  totalSentences: number;
}

function ControlButton({
  label,
  onClick,
  disabled,
  primary,
  children,
}: {
  label: string;
  onClick(): void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40",
        primary
          ? "size-14 bg-[var(--color-accent)] text-white hover:brightness-110"
          : "size-11 border border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]",
      )}
    >
      {children}
    </button>
  );
}

const Icon = ({ path, className }: { path: string; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={cn("size-5", className)}
  >
    <path d={path} />
  </svg>
);

export function ReaderControls({ reader, totalSentences }: ReaderControlsProps) {
  const playing = reader.status === "playing";
  const unsupported = reader.status === "unsupported";
  const progress = totalSentences === 0 ? 0 : (reader.index + 1) / totalSentences;

  if (unsupported) {
    return (
      <div
        role="status"
        className="rounded-[var(--radius-card)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-6 py-4 text-sm text-[var(--color-ink-muted)]"
      >
        This browser cannot read text aloud. The document is still fully readable
        below, and the reading pane keeps its distraction-free layout.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <ControlButton
          label="Back one sentence"
          onClick={() => reader.skip(-1)}
          disabled={reader.index === 0}
        >
          <Icon path="M18 6 9 12l9 6V6ZM6 5v14" />
        </ControlButton>

        <ControlButton
          label={playing ? "Pause" : "Play"}
          primary
          onClick={() => (playing ? reader.pause() : reader.play())}
        >
          {playing ? (
            <Icon path="M9 5v14M15 5v14" className="size-6" />
          ) : (
            <Icon path="M7 4.5v15l13-7.5-13-7.5Z" className="size-6" />
          )}
        </ControlButton>

        <ControlButton
          label="Stop"
          onClick={reader.stop}
          disabled={reader.status === "idle"}
        >
          <Icon path="M6.5 6.5h11v11h-11z" />
        </ControlButton>

        <ControlButton
          label="Forward one sentence"
          onClick={() => reader.skip(1)}
          disabled={reader.index >= totalSentences - 1}
        >
          <Icon path="M6 6l9 6-9 6V6ZM18 5v14" />
        </ControlButton>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Playback speed</legend>
          <span aria-hidden="true" className="text-sm text-[var(--color-ink-muted)]">
            Speed
          </span>
          <div className="flex gap-1">
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => reader.setRate(rate as PlaybackRate)}
                aria-pressed={reader.rate === rate}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-sm font-medium transition",
                  reader.rate === rate
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
                )}
              >
                {rate}×
              </button>
            ))}
          </div>
        </fieldset>

        {reader.voices.length > 0 ? (
          <div className="flex items-center gap-2">
            <label htmlFor="reader-voice" className="text-sm text-[var(--color-ink-muted)]">
              Voice
            </label>
            <select
              id="reader-voice"
              value={reader.voiceURI ?? ""}
              onChange={(event) => reader.setVoiceURI(event.target.value)}
              className="min-h-9 max-w-52 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-2 text-sm"
            >
              <option value="">Browser default</option>
              {reader.voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="space-y-1">
        <div
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={totalSentences}
          aria-valuenow={reader.index + 1}
          className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
        >
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <p className="text-center text-sm text-[var(--color-ink-muted)]">
          Sentence {Math.min(reader.index + 1, totalSentences)} of {totalSentences}
        </p>
      </div>

      {reader.error ? (
        <p role="alert" className="text-center text-sm text-[#a8503f] dark:text-[#e29b8b]">
          {reader.error}
        </p>
      ) : null}
    </div>
  );
}
