"use client";

import { useMemo, useRef, useState } from "react";
import { useAppData } from "@/lib/appData";
import {
  BackupError,
  backupFileName,
  createBackup,
  estimateBackupBytes,
  formatBytes,
  mergeBackup,
  parseBackup,
  type MergeReport,
} from "@/lib/backup";
import { useStoragePersistence } from "@/lib/storagePersistence";
import { createId } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EMPTY_DATA } from "@/lib/storage";

type Notice =
  | { tone: "ok"; text: string }
  | { tone: "error"; text: string }
  | null;

function describeMerge(report: MergeReport) {
  const added = report.added.courses + report.added.tasks + report.added.documents;
  if (added === 0) return "Everything in that backup was already here. Nothing changed.";

  const parts = [
    report.added.courses > 0 && `${report.added.courses} course${report.added.courses === 1 ? "" : "s"}`,
    report.added.tasks > 0 && `${report.added.tasks} task${report.added.tasks === 1 ? "" : "s"}`,
    report.added.documents > 0 && `${report.added.documents} document${report.added.documents === 1 ? "" : "s"}`,
  ].filter(Boolean);

  const skipped = report.skipped.courses + report.skipped.tasks + report.skipped.documents;
  return `Added ${parts.join(", ")}${skipped > 0 ? `, and skipped ${skipped} already here` : ""}.`;
}

export function SettingsView() {
  const { data, ready, replaceAll } = useAppData();
  const { state, asking, requestPersistence } = useStoragePersistence();
  const fileInput = useRef<HTMLInputElement>(null);

  const [notice, setNotice] = useState<Notice>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const backupSize = useMemo(() => (ready ? estimateBackupBytes(data) : 0), [data, ready]);
  const counts = {
    courses: data.courses.length,
    tasks: data.tasks.length,
    documents: data.documents.length,
  };
  const isEmpty = counts.courses + counts.tasks + counts.documents === 0;

  function handleExport() {
    const blob = new Blob([JSON.stringify(createBackup(data), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = backupFileName();
    link.click();
    // Revoked on the next tick so the download has taken the URL first.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice({ tone: "ok", text: `Saved ${backupFileName()} to your downloads.` });
  }

  async function handleImport(file: File) {
    try {
      const report = mergeBackup(data, parseBackup(await file.text()).data, createId);
      replaceAll(report.data);
      setNotice({ tone: "ok", text: describeMerge(report) });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof BackupError
            ? error.message
            : "That file could not be imported.",
      });
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="max-w-prose text-[var(--color-ink-muted)]">
          Your data lives in this browser on this device. Nothing is uploaded
          anywhere, which also means nothing is backed up for you.
        </p>
      </header>

      {notice ? (
        <p
          role="status"
          className={
            notice.tone === "error"
              ? "rounded-xl border border-[#e2b3a9] bg-[#f6e9e6] px-4 py-3 text-sm text-[#a8503f] dark:border-[#5c3a33] dark:bg-[#3a2925] dark:text-[#e29b8b]"
              : "animate-rise-fade rounded-xl bg-[var(--color-accent-wash)] px-4 py-3 text-sm"
          }
        >
          {notice.text}
        </p>
      ) : null}

      <section className="space-y-4">
        <CardTitle>Back up your work</CardTitle>
        <Card className="space-y-4">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {ready
              ? `${counts.courses} ${counts.courses === 1 ? "course" : "courses"}, ${counts.tasks} ${counts.tasks === 1 ? "task" : "tasks"}, ${counts.documents} ${counts.documents === 1 ? "document" : "documents"} — about ${formatBytes(backupSize)}.`
              : "Loading…"}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={handleExport} disabled={!ready || isEmpty}>
              Download a backup
            </Button>

            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              // Visually hidden but still a form control, so it needs a name
              // of its own — the button beside it is what people click, and
              // a screen reader would otherwise reach an unlabelled input.
              aria-label="Choose a backup file to import"
              // Out of the tab order for the same reason: a stop with no
              // visible focus ring reads as focus simply disappearing.
              tabIndex={-1}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
                // Cleared so re-picking the same file still fires change.
                event.target.value = "";
              }}
            />
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              Import a backup
            </Button>
          </div>

          <p className="text-sm text-[var(--color-ink-muted)]">
            Importing adds to what is already here. Anything the backup holds that
            you already have is skipped, so importing the same file twice is safe.
          </p>
        </Card>
      </section>

      <section className="space-y-4">
        <CardTitle>Keep this browser from clearing it</CardTitle>
        <Card className="space-y-4">
          {!state.supported ? (
            <p className="text-sm text-[var(--color-ink-muted)]">
              This browser does not offer durable storage. Download a backup now and
              then, and keep the file somewhere safe.
            </p>
          ) : state.persisted ? (
            <p className="text-sm">
              <span aria-hidden="true">✓ </span>
              This browser has promised to keep your data. It will not be cleared to
              make room for other sites.
              {state.usage !== null ? (
                <span className="text-[var(--color-ink-muted)]">
                  {" "}
                  Using {formatBytes(state.usage)}
                  {state.quota ? ` of about ${formatBytes(state.quota)}` : ""}.
                </span>
              ) : null}
            </p>
          ) : (
            <>
              <p className="text-sm text-[var(--color-ink-muted)]">
                Right now this browser may clear your data if it runs short of room.
                Asking for durable storage stops that.
              </p>
              <Button variant="primary" onClick={requestPersistence} disabled={asking}>
                {asking ? "Asking…" : "Ask the browser to keep it"}
              </Button>
              <p className="text-sm text-[var(--color-ink-muted)]">
                Some browsers only grant this once you have used the app a few times,
                or once you bookmark it. A downloaded backup is the reliable answer
                either way.
              </p>
            </>
          )}
        </Card>
      </section>

      <section className="space-y-4">
        <CardTitle>Start over</CardTitle>
        <Card className="space-y-4">
          <p className="text-sm text-[var(--color-ink-muted)]">
            Removes every course, task and document from this device. There is no
            undo — download a backup first if there is any chance you want it back.
          </p>
          {confirmingReset ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm">Delete everything?</span>
              <Button
                variant="danger"
                onClick={() => {
                  replaceAll(EMPTY_DATA);
                  setConfirmingReset(false);
                  setNotice({ tone: "ok", text: "Everything has been removed." });
                }}
              >
                Yes, delete it all
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
                Keep my data
              </Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingReset(true)} disabled={isEmpty}>
              Delete everything
            </Button>
          )}
        </Card>
      </section>
    </div>
  );
}
