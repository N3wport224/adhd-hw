import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Resolution hook that teaches `node --test` the same import shapes the
 * bundler already understands: the `@/*` alias from tsconfig, and relative
 * imports written without a file extension.
 *
 * Without this, library code would have to choose between the project's
 * conventions and being testable — and code bends toward whatever is easy to
 * test, so the tests would end up dictating the imports.
 */

const SRC = path.join(process.cwd(), "src");
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js"];

function firstExistingFile(base) {
  const candidates = [base, ...EXTENSIONS.map((ext) => `${base}${ext}`)];
  for (const ext of EXTENSIONS) candidates.push(path.join(base, `index${ext}`));
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const resolved = firstExistingFile(path.join(SRC, specifier.slice(2)));
    if (resolved) return next(pathToFileURL(resolved).href, context);
  }

  if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const resolved = firstExistingFile(base);
    if (resolved) return next(pathToFileURL(resolved).href, context);
  }

  return next(specifier, context);
}
