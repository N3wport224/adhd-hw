import {
  htmlBlocks,
  markdownBlocks,
  sizedLinesToBlocks,
  type SizedLine,
} from "@/lib/documents/blocks";
import type { DocumentBlock, DocumentKind, StudyDocumentDraft } from "@/types";

export { mergeWrappedLines } from "@/lib/documents/blocks";

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
    const lines: SizedLine[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      // pdf.js emits positioned text runs, not paragraphs. Its own `hasEOL`
      // flag marks where a visual line ended, and the vertical scale in each
      // run's transform is the glyph size — the only structural signal the
      // format preserves at all.
      let text = "";
      const sizes = new Map<number, number>();

      const flush = () => {
        if (text.trim().length === 0) {
          text = "";
          sizes.clear();
          return;
        }
        // The size that covered the most characters of the line, so a stray
        // superscript cannot decide what kind of line this is.
        let size = 0;
        let best = -1;
        for (const [candidate, chars] of sizes) {
          if (chars > best) {
            size = candidate;
            best = chars;
          }
        }
        lines.push({ text, size });
        text = "";
        sizes.clear();
      };

      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        const size = Math.round(Math.abs(item.transform[3]) * 10) / 10;
        sizes.set(size, (sizes.get(size) ?? 0) + item.str.length);
        if (item.hasEOL) flush();
      }
      flush();
      page.cleanup();
    }

    const tidied = lines
      .map((line) => ({ ...line, text: line.text.replace(/\s+/g, " ").trim() }))
      .filter((line) => line.text.length > 0);

    return { blocks: sizedLinesToBlocks(tidied), pageCount: pdf.numPages };
  } finally {
    // Releases the pdf.js worker; without this each upload leaks one.
    await loadingTask.destroy();
  }
}

async function extractDocx(file: File) {
  // The browser bundle: the default entry point reaches for node built-ins.
  const mammoth = await import("mammoth/mammoth.browser.js");
  const buffer = await file.arrayBuffer();

  // HTML rather than raw text: Word genuinely knows which of its paragraphs
  // are headings and which are list items, and converting to plain text
  // throws all of that away for no reason.
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      // Word's Title and Subtitle styles are not headings by default, so a
      // document's own title would otherwise arrive as an ordinary paragraph.
      styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh"],
    },
  );
  return { blocks: htmlBlocks(result.value), pageCount: null };
}

async function extractText(file: File) {
  const raw = await file.text();
  return { blocks: markdownBlocks(raw), pageCount: null };
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

  let extracted: { blocks: DocumentBlock[]; pageCount: number | null };
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

  if (extracted.blocks.length === 0) {
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
    // Both shapes are stored: the syllabus parser reads flat text, and a
    // document imported before structure existed only ever had that.
    paragraphs: extracted.blocks.map((block) => block.text),
    blocks: extracted.blocks,
    pageCount: extracted.pageCount,
  };
}
