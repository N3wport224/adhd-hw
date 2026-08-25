"use client";

import { useAppData } from "@/lib/appData";

/**
 * A failed write is the one problem a student cannot detect on their own —
 * everything still looks saved until the tab closes. Uploading a term's
 * readings is what will realistically fill the quota, so this says what to do
 * about it rather than only that something went wrong.
 */
export function SaveErrorBanner() {
  const { saveError } = useAppData();
  if (!saveError) return null;

  return (
    <div
      role="alert"
      className="border-b border-[#e2b3a9] bg-[#f6e9e6] px-5 py-3 text-sm text-[#a8503f] dark:border-[#5c3a33] dark:bg-[#3a2925] dark:text-[#e29b8b] lg:px-10"
    >
      {saveError}
    </div>
  );
}
