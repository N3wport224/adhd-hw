import type { DocumentKind, StudyDocumentDraft } from "@/types";

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;

/** Big enough for a term's readings, small enough to keep parsing responsive. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class ExtractionError extends Error {}

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export function kindForFile(fileName: string): DocumentKind | null {
  switch (extensionOf(fileName)) {
    case ".pdf":
      return "pdf";
    case ".docx":
      return "docx";
    case ".txt":
    case ".md":
      return "text";
    default:
      return null;
  }
}

export function titleFromFileName(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  const base = dot === -1 ? fileName : fileName.slice(0, dot);
  return base.replace(/[_-]+/g, " ").trim() || fileName;
}

/**
 * Collapses runs of whitespace and drops empty entries. Extracted text is
 * full of stray newlines and double spaces from layout, and those turn into
 * audible stumbles once a screen reader or the speech synthesiser hits them.
 */
function tidyParagraphs(blocks: string[]) {
  return blocks
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter((block) => block.length > 0);
}

async function extractPdf(file: File) {
  // Loaded on demand: pdf.js is well over a megabyte, and someone who never
  // opens a PDF should never pay for it.
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  try {
    const paragraphs: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      // pdf.js emits positioned text runs, not paragraphs. Its own
      // `hasEOL` flag marks where a visual line ended, which is the closest
      // thing to structure the format actually preserves.
      let line = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          paragraphs.push(line);
          line = "";
        }
      }
      if (line.trim()) paragraphs.push(line);
      page.cleanup();
    }

    return { paragraphs: mergeWrappedLines(tidyParagraphs(paragraphs)), pageCount: pdf.numPages };
  } finally {
    // Releases the pdf.js worker; without this each upload leaks one.
    await loadingTask.destroy();
  }
}

/**
 * PDF lines break at the page margin, not at the end of a thought. Rejoining
 * them matters here beyond tidiness: the reader speaks and highlights one
 * sentence at a time, and a sentence chopped across three "paragraphs" would
 * be read as three disconnected fragments.
 */
export function mergeWrappedLines(lines: string[]) {
  const merged: string[] = [];
  for (const line of lines) {
    const previous = merged[merged.length - 1];
    const continuesPrevious =
      previous !== undefined &&
      // The previous line stopped mid-sentence. A colon is treated as a stop
      // because it usually introduces a list; a semicolon is not, because it
      // almost always sits inside one continuing sentence.
      !/[.!?:]["')\]]?$/.test(previous) &&
      // ...and this one is not a new heading or list item.
      !/^[-•*•]|^\d+[.)]\s/.test(line) &&
      previous.length > 40;

    if (continuesPrevious) {
      merged[merged.length - 1] = `${previous.replace(/-$/, "")}${
        previous.endsWith("-") ? "" : " "
      }${line}`;
    } else {
      merged.push(line);
    }
  }
  return merged;
}

async function extractDocx(file: File) {
  // The browser bundle: the default entry point reaches for node built-ins.
  const mammoth = await import("mammoth/mammoth.browser.js");
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return { paragraphs: tidyParagraphs(result.value.split(/\n+/)), pageCount: null };
}

async function extractText(file: File) {
  const raw = await file.text();
  return { paragraphs: tidyParagraphs(raw.split(/\n\s*\n+|\n/)), pageCount: null };
}

/**
 * Reads a dropped file into the shape the library and reader store.
 * Everything happens in the browser — no document is ever uploaded anywhere.
 */
export async function extractDocument(
  file: File,
  courseId: string | null,
): Promise<StudyDocumentDraft> {
  const kind = kindForFile(file.name);
  if (!kind) {
    throw new ExtractionError(
      `${file.name} is not a supported file. Try a PDF, Word document, or text file.`,
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ExtractionError(
      `${file.name} is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB.`,
    );
  }

  let extracted: { paragraphs: string[]; pageCount: number | null };
  try {
    if (kind === "pdf") extracted = await extractPdf(file);
    else if (kind === "docx") extracted = await extractDocx(file);
    else extracted = await extractText(file);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError(
      `Could not read ${file.name}. It may be password-protected or damaged.`,
    );
  }

  if (extracted.paragraphs.length === 0) {
    throw new ExtractionError(
      `No readable text in ${file.name}. Scanned pages need OCR before they can be read aloud.`,
    );
  }

  return {
    courseId,
    title: titleFromFileName(file.name),
    fileName: file.name,
    kind,
    fileSize: file.size,
    paragraphs: extracted.paragraphs,
    pageCount: extracted.pageCount,
  };
}
