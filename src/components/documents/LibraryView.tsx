"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { controlClass } from "@/components/ui/Field";
import { DocumentDropzone } from "@/components/documents/DocumentDropzone";
import { DocumentRow } from "@/components/documents/DocumentRow";
import type { DocumentKind, StudyDocument } from "@/types";

type SortKey = "recent" | "oldest" | "title" | "kind";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "recent", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "title", label: "Title A–Z" },
  { key: "kind", label: "File type" },
];

const KIND_FILTERS: Array<{ key: DocumentKind | "all"; label: string }> = [
  { key: "all", label: "All types" },
  { key: "pdf", label: "PDF" },
  { key: "docx", label: "Word" },
  { key: "text", label: "Text" },
];

function compare(a: StudyDocument, b: StudyDocument, sort: SortKey) {
  switch (sort) {
    case "oldest":
      return a.createdAt.localeCompare(b.createdAt);
    case "title":
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    case "kind":
      return a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title);
    default:
      return b.createdAt.localeCompare(a.createdAt);
  }
}

export function LibraryView() {
  const { data, ready } = useAppData();
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<DocumentKind | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const visible = useMemo(() => {
    return data.documents
      .filter((document) => {
        if (kindFilter !== "all" && document.kind !== kindFilter) return false;
        if (courseFilter === "all") return true;
        if (courseFilter === "unfiled") return document.courseId === null;
        return document.courseId === courseFilter;
      })
      .sort((a, b) => compare(a, b, sort));
  }, [data.documents, courseFilter, kindFilter, sort]);

  /**
   * Documents stay grouped under their course rather than becoming one long
   * list. Course is the unit a student actually thinks in, and a flat list of
   * everything is the failure this app is built to avoid.
   */
  const groups = useMemo(() => {
    const byCourse = new Map<string, StudyDocument[]>();
    for (const document of visible) {
      const key = document.courseId ?? "unfiled";
      const existing = byCourse.get(key);
      if (existing) existing.push(document);
      else byCourse.set(key, [document]);
    }

    // Course order, not upload order, so the library reads the same every time.
    const ordered = data.courses
      .filter((course) => byCourse.has(course.id))
      .map((course) => ({
        key: course.id,
        title: course.name,
        code: course.code,
        color: COURSE_COLORS[course.color].accent,
        documents: byCourse.get(course.id) ?? [],
      }));

    if (byCourse.has("unfiled")) {
      ordered.push({
        key: "unfiled",
        title: "Unfiled",
        code: "",
        color: "bg-[var(--color-border-soft)]",
        documents: byCourse.get("unfiled") ?? [],
      });
    }
    return ordered;
  }, [visible, data.courses]);

  const unfiledCount = data.documents.filter((document) => !document.courseId).length;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <CardTitle>Add a reading</CardTitle>
        <DocumentDropzone courseId={null} />
      </section>

      <section className="space-y-4">
        <div className="space-y-4">
          <div>
            <CardTitle>Library</CardTitle>
            <p className="text-sm text-[var(--color-ink-muted)]">
              {ready
                ? `${data.documents.length} ${data.documents.length === 1 ? "document" : "documents"}`
                : "Loading…"}
              {unfiledCount > 0 ? ` · ${unfiledCount} unfiled` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="library-course">
              Filter by course
            </label>
            <select
              id="library-course"
              value={courseFilter}
              onChange={(event) => setCourseFilter(event.target.value)}
              className={controlClass("sm")}
            >
              <option value="all">All courses</option>
              {data.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code || course.name}
                </option>
              ))}
              <option value="unfiled">Unfiled</option>
            </select>

            <label className="sr-only" htmlFor="library-kind">
              Filter by file type
            </label>
            <select
              id="library-kind"
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value as DocumentKind | "all")}
              className={controlClass("sm")}
            >
              {KIND_FILTERS.map((filter) => (
                <option key={filter.key} value={filter.key}>
                  {filter.label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="library-sort">
              Sort by
            </label>
            <select
              id="library-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className={controlClass("sm")}
            >
              {SORTS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!ready ? (
          <div
            aria-hidden="true"
            className="h-32 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]"
          />
        ) : data.documents.length === 0 ? (
          <EmptyState
            title="Your library is empty"
            body="Drop in a reading above. It is parsed here in the browser, then you can have it read aloud with the current sentence highlighted."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Nothing matches those filters"
            body="Try widening the course or file type filter."
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.key} className="space-y-2">
                <h3 className="flex items-center gap-2 px-1 text-sm font-semibold">
                  <span
                    aria-hidden="true"
                    className={cn("size-2.5 rounded-full", group.color)}
                  />
                  {group.title}
                  {group.code ? (
                    <span className="font-normal text-[var(--color-ink-muted)]">
                      {group.code}
                    </span>
                  ) : null}
                  <span className="font-normal text-[var(--color-ink-muted)]">
                    · {group.documents.length}
                  </span>
                </h3>
                <Card padded={false} className="divide-y divide-[var(--color-border-soft)] px-6">
                  {group.documents.map((document) => (
                    <DocumentRow key={document.id} document={document} showCourse={false} />
                  ))}
                </Card>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
