"use client";

import { useCallback, useEffect, useState } from "react";
import { adminPatch, adminPost } from "@/lib/adminApi";
import { loadPartBins, searchBins } from "@/lib/lookup";
import { SearchSelect, type SearchOption } from "@/components/SearchSelect";
import { PartDetailsForm } from "@/components/admin/PartDetailsForm";
import { DeletePartButton } from "@/components/admin/DeletePartButton";
import { NO_PROJECT, ProjectSelect } from "@/components/admin/ProjectSelect";

type Bin = { locationId: string; barcode: string; quantity: number };

// Admin-only panel shown under an expanded row on /stock: rename the part,
// manage the bins holding it and the quantity in each, or delete it outright.
export function InlineStockEditor({
  partId,
  description,
  itemNo,
  onChanged,
  onDeleted,
}: {
  partId: string;
  description: string;
  itemNo: string | null;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [bins, setBins] = useState<Bin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBins(await loadPartBins(partId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bins.");
    }
  }, [partId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => {
    void load();
    onChanged();
  }, [load, onChanged]);

  return (
    <div className="space-y-3">
      <PartDetailsForm
        partId={partId}
        description={description}
        onChanged={onChanged}
      />

      <div className="space-y-2 border-t border-steel-200 pt-3 dark:border-steel-800">
        {error && (
          <p className="text-sm text-stock-none">{error}</p>
        )}
        {!bins && !error && (
          <p className="text-sm text-steel-500">Loading bins…</p>
        )}
        {bins?.length === 0 && (
          <p className="text-sm text-steel-500">
            No bins hold this part — it has no item number and can&apos;t be
            scanned until one is attached.
          </p>
        )}
        {bins?.map((bin) => (
          <BinRow key={bin.locationId} bin={bin} onChanged={reload} />
        ))}
        <AttachBin partId={partId} onAttached={reload} />
      </div>

      <div className="flex justify-end border-t border-steel-200 pt-3 dark:border-steel-800">
        <DeletePartButton
          partId={partId}
          itemNo={itemNo}
          description={description}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  );
}

function BinRow({ bin, onChanged }: { bin: Bin; onChanged: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [barcode, setBarcode] = useState(bin.barcode);
  // Applies to "− sub" only. "+ add" is a delivery and "= set" is a
  // correction; neither is stock consumed by a job.
  const [projectId, setProjectId] = useState(NO_PROJECT);

  async function run(mode: "restock" | "subtract" | "correct") {
    setNote(null);
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      setNote("Enter a whole number.");
      return;
    }
    if (mode !== "correct" && n < 1) {
      setNote("Enter 1 or more.");
      return;
    }
    setBusy(mode);
    try {
      await adminPost(`/api/admin/${mode}`, {
        location_id: bin.locationId,
        quantity: n,
        ...(mode === "subtract" && projectId !== NO_PROJECT
          ? { project_id: projectId }
          : {}),
      });
      setValue("");
      onChanged();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function rename() {
    const next = barcode.trim();
    if (!next || next === bin.barcode) {
      setRenaming(false);
      setBarcode(bin.barcode);
      return;
    }
    setBusy("rename");
    setNote(null);
    try {
      await adminPatch("/api/admin/locations", {
        location_id: bin.locationId,
        barcode_code: next,
      });
      setRenaming(false);
      onChanged();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed.");
      setBarcode(bin.barcode);
    } finally {
      setBusy(null);
    }
  }

  async function detach() {
    setBusy("detach");
    setNote(null);
    try {
      await adminPatch("/api/admin/locations", {
        location_id: bin.locationId,
        part_id: null,
      });
      onChanged();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "rounded-md border border-steel-300 px-2 py-1 font-medium hover:bg-steel-100 disabled:opacity-50 dark:border-steel-700 dark:hover:bg-steel-800";

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {renaming ? (
          <>
            <input
              value={barcode}
              autoFocus
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void rename();
                if (e.key === "Escape") {
                  setRenaming(false);
                  setBarcode(bin.barcode);
                }
              }}
              className="w-40 rounded-md border border-steel-300 bg-white px-2 py-1 font-mono dark:border-steel-700 dark:bg-steel-950"
            />
            <button
              type="button"
              onClick={() => void rename()}
              disabled={busy !== null}
              className={btn}
            >
              {busy === "rename" ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setBarcode(bin.barcode);
              }}
              className={btn}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              title="Rename this bin's barcode"
              className="font-mono text-steel-500 underline decoration-dotted underline-offset-2 hover:text-steel-900 dark:hover:text-steel-100"
            >
              {bin.barcode}
            </button>
            <span className="text-steel-600 dark:text-steel-400">
              now {bin.quantity}
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="qty"
              className="w-20 rounded-md border border-steel-300 bg-white px-2 py-1 dark:border-steel-700 dark:bg-steel-950"
            />
            <button
              type="button"
              onClick={() => void run("restock")}
              disabled={busy !== null || value === ""}
              className={btn}
            >
              {busy === "restock" ? "…" : "+ add"}
            </button>
            <ProjectSelect
              id={`inline-project-${bin.locationId}`}
              className="max-w-[11rem] rounded-md border border-steel-300 bg-white px-2 py-1 dark:border-steel-700 dark:bg-steel-950"
              value={projectId}
              onChange={setProjectId}
              disabled={busy !== null}
            />
            <button
              type="button"
              onClick={() => void run("subtract")}
              disabled={busy !== null || value === ""}
              title={
                projectId === NO_PROJECT
                  ? "Remove stock without booking it to a project"
                  : "Remove stock and book it to the selected project"
              }
              className={btn}
            >
              {busy === "subtract" ? "…" : "− sub"}
            </button>
            <button
              type="button"
              onClick={() => void run("correct")}
              disabled={busy !== null || value === ""}
              className={btn}
            >
              {busy === "correct" ? "…" : "= set"}
            </button>
            <button
              type="button"
              onClick={() => void detach()}
              disabled={busy !== null}
              title="Empty this bin (the bin stays, the part leaves it)"
              className="px-1 text-steel-400 hover:text-stock-none disabled:opacity-50"
            >
              {busy === "detach" ? "…" : "×"}
            </button>
          </>
        )}
        {note && <span className="text-stock-none">{note}</span>}
      </div>
      {renaming && (
        <p className="text-xs text-brand-text dark:text-brand">
          This is the barcode printed on the bin. Renaming it means the existing
          label no longer scans — reprint it from Admin → Bin labels.
        </p>
      )}
    </div>
  );
}

// Attaches an existing empty bin to this part. Only unassigned bins are
// offered: a bin holds at most one part, so taking one that is in use would
// silently empty another part.
function AttachBin({
  partId,
  onAttached,
}: {
  partId: string;
  onAttached: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const search = useCallback(async (q: string): Promise<SearchOption[]> => {
    const bins = await searchBins(q, { assigned: "no" });
    return bins.map((b) => ({ id: b.id, label: b.barcode_code }));
  }, []);

  async function attach(locationId: string | null) {
    if (!locationId) return;
    setBusy(true);
    setNote(null);
    try {
      await adminPatch("/api/admin/locations", {
        location_id: locationId,
        part_id: partId,
      });
      onAttached();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-steel-500">Attach bin</span>
      <div className="w-56">
        <SearchSelect
          search={search}
          value={null}
          onChange={(id) => void attach(id)}
          placeholder={busy ? "Attaching…" : "Search empty bins…"}
        />
      </div>
      {note && <span className="text-stock-none">{note}</span>}
    </div>
  );
}
