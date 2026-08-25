"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Sentence } from "@/lib/documents/sentences";
import { useLatestRef } from "@/lib/useLatestRef";

export type SpeechStatus = "unsupported" | "idle" | "playing" | "paused" | "error";

/** Browser support never changes within a session, so there is nothing to subscribe to. */
const subscribeNothing = () => () => {};

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export interface SpeechReader {
  status: SpeechStatus;
  error: string | null;
  /** Sentence currently spoken, or the one that will be spoken next. */
  index: number;
  /** Character offset inside the current sentence, when the browser reports it. */
  charIndex: number | null;
  rate: PlaybackRate;
  voices: SpeechSynthesisVoice[];
  voiceURI: string | null;
  play(fromIndex?: number): void;
  pause(): void;
  stop(): void;
  skip(delta: number): void;
  jumpTo(index: number): void;
  setRate(rate: PlaybackRate): void;
  setVoiceURI(voiceURI: string): void;
}

interface UseSpeechReaderOptions {
  sentences: Sentence[];
  initialIndex?: number;
  /** Called as playback moves, so the caller can persist the resume point. */
  onIndexChange?(index: number): void;
}

/**
 * Drives `speechSynthesis` one sentence at a time.
 *
 * Speaking the whole document as a single utterance would be less code, but
 * the browser reports almost nothing about its progress through one, and
 * Chrome cuts long utterances off after about fifteen seconds. Per-sentence
 * utterances give exact highlighting, working skip controls, and a natural
 * unit to resume from — on every browser, not just the ones that implement
 * boundary events.
 */
export function useSpeechReader({
  sentences,
  initialIndex = 0,
  onIndexChange,
}: UseSpeechReaderOptions): SpeechReader {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(initialIndex);
  const [charIndex, setCharIndex] = useState<number | null>(null);
  const [rate, setRateState] = useState<PlaybackRate>(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURIState] = useState<string | null>(null);

  // Bumped whenever playback is interrupted. Cancelling an utterance fires its
  // `onend` just like finishing does, so handlers compare against this to tell
  // "the sentence finished" from "something else took over".
  const generation = useRef(0);
  const rateRef = useLatestRef(rate);
  const voiceURIRef = useLatestRef(voiceURI);
  const sentencesRef = useLatestRef(sentences);
  const onIndexChangeRef = useLatestRef(onIndexChange);
  // Lets the recursive sentence-to-sentence chain call forward without
  // `speakFrom` depending on itself.
  const speakFromRef = useRef<(from: number) => void>(() => {});

  // Read through a store subscription rather than a bare `typeof window`
  // check: the server snapshot assumes support, so the markup ships the real
  // controls and only a browser that genuinely lacks the API swaps in the
  // fallback — no hydration mismatch, and no flash of "not supported".
  const supported = useSyncExternalStore(
    subscribeNothing,
    () => typeof window.speechSynthesis !== "undefined",
    () => true,
  );

  useEffect(() => {
    if (!supported) return;

    const synth = window.speechSynthesis;
    const readVoices = () => setVoices(synth.getVoices());
    readVoices();
    // Voices load asynchronously in Chrome; the first call often returns [].
    synth.addEventListener("voiceschanged", readVoices);

    return () => {
      synth.removeEventListener("voiceschanged", readVoices);
      generation.current += 1;
      synth.cancel();
    };
  }, [supported]);

  /**
   * Chrome stops speaking after roughly fifteen seconds. Per-sentence
   * utterances stay under that, but a long unpunctuated sentence can still
   * trip it, so nudge the queue while playback is meant to be running.
   */
  useEffect(() => {
    if (!supported || status !== "playing") return;
    const timer = window.setInterval(() => {
      const synth = window.speechSynthesis;
      if (synth.speaking && !synth.paused) synth.resume();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [supported, status]);

  const speakFrom = useCallback(
    (from: number) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      const list = sentencesRef.current;

      if (from >= list.length) {
        generation.current += 1;
        synth.cancel();
        setStatus("idle");
        setCharIndex(null);
        return;
      }

      const target = Math.max(0, from);
      const token = (generation.current += 1);
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(list[target].text);
      utterance.rate = rateRef.current;
      const voice = synth.getVoices().find((item) => item.voiceURI === voiceURIRef.current);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.onstart = () => {
        if (token !== generation.current) return;
        setStatus("playing");
        setError(null);
      };
      utterance.onboundary = (event) => {
        if (token !== generation.current) return;
        // Not every browser fires this; the sentence highlight never depends on it.
        setCharIndex(event.charIndex);
      };
      utterance.onend = () => {
        if (token !== generation.current) return;
        setCharIndex(null);
        speakFromRef.current(target + 1);
      };
      utterance.onerror = (event) => {
        if (token !== generation.current) return;
        // Our own cancel() surfaces here on some browsers — not a failure.
        if (event.error === "interrupted" || event.error === "canceled") return;
        setStatus("error");
        setCharIndex(null);
        setError(
          event.error === "not-allowed"
            ? "Your browser blocked audio. Press play again to allow it."
            : "Speech stopped unexpectedly. Try playing again.",
        );
      };

      setIndex(target);
      setCharIndex(null);
      onIndexChangeRef.current?.(target);
      synth.speak(utterance);
    },
    [supported, rateRef, voiceURIRef, sentencesRef, onIndexChangeRef],
  );

  useEffect(() => {
    speakFromRef.current = speakFrom;
  }, [speakFrom]);

  const play = useCallback(
    (fromIndex?: number) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      // Resuming a pause is not the same as starting: restarting the sentence
      // from the top would make every interruption cost the listener a replay.
      if (fromIndex === undefined && synth.paused && synth.speaking) {
        synth.resume();
        setStatus("playing");
        return;
      }
      speakFrom(fromIndex ?? index);
    },
    [supported, speakFrom, index],
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    generation.current += 1;
    window.speechSynthesis.cancel();
    setStatus("idle");
    setCharIndex(null);
  }, [supported]);

  const jumpTo = useCallback(
    (target: number) => {
      const clamped = Math.min(
        Math.max(target, 0),
        Math.max(sentencesRef.current.length - 1, 0),
      );
      if (status === "playing" || status === "paused") {
        speakFrom(clamped);
      } else {
        setIndex(clamped);
        setCharIndex(null);
        onIndexChangeRef.current?.(clamped);
      }
    },
    [status, speakFrom, sentencesRef, onIndexChangeRef],
  );

  const skip = useCallback((delta: number) => jumpTo(index + delta), [jumpTo, index]);

  const setRate = useCallback(
    (next: PlaybackRate) => {
      setRateState(next);
      // A live utterance keeps the rate it was created with, so the only way
      // to apply a change now is to restart the sentence being spoken.
      if (status === "playing") {
        rateRef.current = next;
        speakFrom(index);
      }
    },
    [status, speakFrom, index, rateRef],
  );

  const setVoiceURI = useCallback(
    (next: string) => {
      setVoiceURIState(next);
      if (status === "playing") {
        voiceURIRef.current = next;
        speakFrom(index);
      }
    },
    [status, speakFrom, index, voiceURIRef],
  );

  const publicStatus: SpeechStatus = supported ? status : "unsupported";

  return useMemo(
    () => ({
      status: publicStatus,
      error,
      index,
      charIndex,
      rate,
      voices,
      voiceURI,
      play,
      pause,
      stop,
      skip,
      jumpTo,
      setRate,
      setVoiceURI,
    }),
    [
      publicStatus, error, index, charIndex, rate, voices, voiceURI,
      play, pause, stop, skip, jumpTo, setRate, setVoiceURI,
    ],
  );
}
