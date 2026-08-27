import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * Contrast guards on the design tokens.
 *
 * A single accent token was doing two incompatible jobs — a filled background
 * that white sits on, and a text colour on pale surfaces. The value light
 * enough to read on a dark background is far too light to put white on, which
 * is how every primary button in dark mode ended up at 2.4:1 against a
 * requirement of 4.5.
 *
 * The tokens are read out of the stylesheet rather than duplicated here, so
 * there is still one source of truth and changing a colour re-runs the maths.
 */

const CSS = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

/** Token values from `:root` (light) and from the `.dark` block. */
function tokens(theme: "light" | "dark") {
  const darkBlock = /\.dark\s*\{([\s\S]*?)\n\s*\}/.exec(CSS)?.[1] ?? "";
  const themeBlock = /@theme\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";
  const source = theme === "dark" ? `${themeBlock}\n${darkBlock}` : themeBlock;

  const found = new Map<string, string>();
  for (const match of source.matchAll(/(--color-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    // Later definitions win, which is how the dark block overrides the base.
    found.set(match[1], match[2]);
  }
  return found;
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA for body-sized text. */
const AA = 4.5;

const PAIRS: Array<[string, string, string]> = [
  ["body text on the page", "--color-ink", "--color-canvas"],
  ["body text on a card", "--color-ink", "--color-surface"],
  ["muted text on the page", "--color-ink-muted", "--color-canvas"],
  ["muted text on a card", "--color-ink-muted", "--color-surface"],
  ["muted text on a muted panel", "--color-ink-muted", "--color-surface-muted"],
  ["label on a filled accent button", "--color-on-accent", "--color-accent"],
  ["accent used as text on a card", "--color-accent", "--color-surface"],
  ["accent used as text on the page", "--color-accent", "--color-canvas"],
  ["accent used as text on the accent wash", "--color-accent", "--color-accent-wash"],
  ["body text on the accent wash", "--color-ink", "--color-accent-wash"],
  ["body text on a soft accent chip", "--color-ink", "--color-accent-soft"],
];

for (const theme of ["light", "dark"] as const) {
  test(`${theme} theme clears WCAG AA on every text pair`, () => {
    const values = tokens(theme);

    for (const [label, fg, bg] of PAIRS) {
      const foreground = values.get(fg);
      const background = values.get(bg);
      assert.ok(foreground, `${theme}: ${fg} is not defined`);
      assert.ok(background, `${theme}: ${bg} is not defined`);

      const ratio = contrast(foreground, background);
      assert.ok(
        ratio >= AA,
        `${theme}: ${label} is ${ratio.toFixed(2)}:1 (${foreground} on ${background}), needs ${AA}`,
      );
    }
  });
}

test("the accent works as a background and as text, which is why it is two tokens", () => {
  for (const theme of ["light", "dark"] as const) {
    const values = tokens(theme);
    const accent = values.get("--color-accent")!;
    const onAccent = values.get("--color-on-accent")!;

    // The pair has to work in the direction it is actually used: something
    // legible sits on top of the accent, and the accent itself is legible on
    // the surfaces behind it.
    assert.ok(
      contrast(onAccent, accent) >= AA,
      `${theme}: nothing legible sits on the accent (${contrast(onAccent, accent).toFixed(2)}:1)`,
    );
    assert.notEqual(
      accent.toLowerCase(),
      onAccent.toLowerCase(),
      `${theme}: the accent and what sits on it must differ`,
    );
  }
});

test("the focus ring is visible against everything it outlines", () => {
  for (const theme of ["light", "dark"] as const) {
    const values = tokens(theme);
    const focus = values.get("--color-focus")!;
    // 3:1 is the WCAG threshold for a non-text indicator.
    for (const surface of ["--color-canvas", "--color-surface", "--color-surface-muted"]) {
      const ratio = contrast(focus, values.get(surface)!);
      assert.ok(
        ratio >= 3,
        `${theme}: the focus ring is ${ratio.toFixed(2)}:1 against ${surface}, needs 3`,
      );
    }
  }
});
