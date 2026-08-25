import type { Metadata } from "next";
import { ComingNext } from "@/components/ui/ComingNext";

export const metadata: Metadata = { title: "Reader — Steady" };

export default function ReaderPage() {
  return (
    <ComingNext
      title="Reader"
      intro="Import a PDF or Word document and have it read aloud in a clean pane, with the current sentence highlighted as it goes."
      items={[
        "Client-side PDF and DOCX text extraction, so documents never leave the device.",
        "Play, pause, skip by sentence, and speed from 0.75x to 2x via the Web Speech API.",
        "Sentence-level highlighting that follows the voice, and a saved position per document.",
      ]}
    />
  );
}
