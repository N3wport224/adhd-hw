"use client";

import { useCallback, useMemo, useState } from "react";
import { parseSyllabus, type SyllabusParseResult } from "@/lib/syllabusParser";
import { guessTermStart } from "@/lib/syllabusDates";
import { SyllabusReviewModal } from "@/components/syllabus/SyllabusReviewModal";
import type { Course, StudyDocument } from "@/types";

export interface ScanSummary {
  added: number;
  skipped: number;
  weights: number;
}

interface SyllabusScannerProps {
  course: Course;
  /** The document to scan; null closes the flow. */
  document: StudyDocument | null;
  onClose(): void;
  onImported(summary: ScanSummary): void;
}

/**
 * Owns the parse-and-review flow: re-parses whenever the term start changes,
 * and hands the result to the modal.
 *
 * Parsing lives here rather than in the modal so changing the term start
 * re-reads the document instead of trying to shift dates that were already
 * resolved — "Week 4" cannot be adjusted after the fact, it has to be worked
 * out again from the new anchor.
 */
export function SyllabusScanner({
  course,
  document,
  onClose,
  onImported,
}: SyllabusScannerProps) {
  const [termStart, setTermStart] = useState<string>(
    () => course.termStart ?? guessTermStart(),
  );

  const result: SyllabusParseResult | null = useMemo(
    () => (document ? parseSyllabus(document.paragraphs, { termStart }) : null),
    [document, termStart],
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!document || !result) return null;

  return (
    <SyllabusReviewModal
      open
      course={course}
      document={document}
      result={result}
      onChangeTermStart={setTermStart}
      onClose={handleClose}
      onImported={onImported}
    />
  );
}

/**
 * Decides whether a freshly uploaded document is worth offering to scan.
 * Deliberately generous — the review step is cheap to dismiss, and a syllabus
 * that is silently ignored is the failure that costs a student a deadline.
 */
export function shouldOfferScan(document: StudyDocument, termStart?: string | null) {
  if (/syllabus|outline|schedule/i.test(`${document.fileName} ${document.title}`)) return true;
  const result = parseSyllabus(document.paragraphs, {
    termStart: termStart ?? guessTermStart(),
  });
  return result.looksLikeSyllabus && (result.assignments.length > 0 || result.gradingWeights.length > 0);
}
