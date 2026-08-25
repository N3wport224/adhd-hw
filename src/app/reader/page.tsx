import type { Metadata } from "next";
import { LibraryView } from "@/components/documents/LibraryView";

export const metadata: Metadata = { title: "Library — Steady" };

export default function LibraryPage() {
  return <LibraryView />;
}
