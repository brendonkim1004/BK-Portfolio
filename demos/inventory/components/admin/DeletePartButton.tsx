"use client";

import { useState } from "react";
import { adminDelete } from "@/lib/adminApi";
import { buttonDanger } from "@/components/admin/formStyles";

// Permanently delete a part, guarded by typing its item number.
//
// A browser confirm() would block the whole extension/scanner session and is
// one careless Enter away from firing, so the guard is an inline field that has
// to match. The server re-checks what is typed against the database before it
// deletes anything — this is the friction, not the security boundary.
export function DeletePartButton({
  partId,
  itemNo,
  description,
  onDeleted,
}: {
  partId: string;
  itemNo: string | null;
  description: string;
  onDeleted: () => void;
}) {
  const [arming, setArming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A part with no bin has no item number to type, so its description stands in
  // — the same value the server expects.
  const expected = itemNo ?? description;
  const matches = typed.trim() === expected;

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await adminDelete("/api/admin/parts", {
        part_id: partId,
        confirm: typed.trim(),
      });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
      setBusy(false);
    }
  }

  if (!arming) {
    return (
      <button
        type="button"
        onClick={() => {
          setArming(true);
          setTyped("");
          setError(null);
        }}
        className={buttonDanger}
      >
        Delete part
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
      <span className="text-steel-600 dark:text-steel-400">
        Type <span className="font-mono font-semibold">{expected}</span> to
        delete:
      </span>
      <input
        value={typed}
        autoFocus
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches && !busy) void remove();
          if (e.key === "Escape") setArming(false);
        }}
        className="w-40 rounded-md border border-steel-300 bg-white px-2 py-1 font-mono dark:border-steel-700 dark:bg-steel-950"
      />
      <button
        type="button"
        onClick={() => void remove()}
        disabled={!matches || busy}
        className="rounded-md bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-40"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      <button
        type="button"
        onClick={() => setArming(false)}
        disabled={busy}
        className="rounded-md border border-steel-300 px-2 py-1 font-medium hover:bg-steel-100 disabled:opacity-50 dark:border-steel-700 dark:hover:bg-steel-800"
      >
        Cancel
      </button>
      {error && <span className="text-stock-none">{error}</span>}
    </div>
  );
}
