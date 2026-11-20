"use client";

import { useState } from "react";
import { adminPatch } from "@/lib/adminApi";

// Rename a part, from the admin panel on /stock.
export function PartDetailsForm({
  partId,
  description,
  onChanged,
}: {
  partId: string;
  description: string;
  onChanged: () => void;
}) {
  const [value, setValue] = useState(description);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = value.trim() !== description.trim();

  async function save() {
    const next = value.trim();
    if (!next) {
      setNote({ ok: false, text: "Description can't be empty." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await adminPatch("/api/admin/parts", {
        part_id: partId,
        description: next,
      });
      setNote({ ok: true, text: "Saved." });
      onChanged();
    } catch (err) {
      setNote({
        ok: false,
        text: err instanceof Error ? err.message : "Failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="w-20 shrink-0 text-steel-500" htmlFor={`desc-${partId}`}>
        Description
      </label>
      <input
        id={`desc-${partId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty && !busy) void save();
        }}
        className="min-w-0 flex-1 rounded-md border border-steel-300 bg-white px-2 py-1 dark:border-steel-700 dark:bg-steel-950"
      />
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy || !dirty}
        className="rounded-md border border-steel-300 px-2 py-1 font-medium hover:bg-steel-100 disabled:opacity-50 dark:border-steel-700 dark:hover:bg-steel-800"
      >
        {busy ? "…" : "Save"}
      </button>
      {note && (
        <span
          className={
            note.ok
              ? "text-stock-ok"
              : "text-stock-none"
          }
        >
          {note.text}
        </span>
      )}
    </div>
  );
}
