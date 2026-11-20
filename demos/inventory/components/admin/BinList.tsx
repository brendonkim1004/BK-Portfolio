"use client";

import { useCallback, useEffect, useState } from "react";
import { adminPatch } from "@/lib/adminApi";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { sanitize, searchParts } from "@/lib/lookup";
import { SearchSelect, type SearchOption } from "@/components/SearchSelect";
import { buttonSecondary, buttonSmall, card, input } from "./formStyles";

const PAGE_SIZE = 50;

type Row = {
  id: string;
  barcode_code: string;
  part_id: string | null;
  partLabel: string | null;
};

type RawRow = {
  id: string;
  barcode_code: string;
  part_id: string | null;
  // PostgREST returns a single object for this many-to-one embed.
  parts: { sku: number; description: string } | null;
};

// Lists bins, and lets the admin rename an item number or change which part a
// bin holds.
//
// Both the bin list and the part picker are served a page at a time by
// Postgres. This used to receive the entire catalog as props and filter it in
// the browser, which meant /admin downloaded every part and every bin — around
// fourteen round-trips — before it could render anything.
export function BinList({ refreshToken }: { refreshToken: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = getSupabaseBrowserClient()
      .from("locations")
      .select("id, barcode_code, part_id, parts(sku, description)", {
        count: "exact",
      })
      .order("barcode_code", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    // Barcode only: filtering on the embedded part would force an inner join
    // and hide every empty bin, which is exactly what an admin is looking for
    // when assigning parts. Searching by part name is what /stock is for.
    const term = sanitize(query);
    if (term) q = q.ilike("barcode_code", `*${term}*`);

    const { data, count, error: err } = await q;
    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setError(null);
      setRows(
        ((data ?? []) as unknown as RawRow[]).map((l) => ({
          id: l.id,
          barcode_code: l.barcode_code,
          part_id: l.part_id,
          partLabel: l.parts
            ? `SKU ${l.parts.sku} — ${l.parts.description}`
            : null,
        })),
      );
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [query, page]);

  // refreshToken belongs on the effect, not on load(): it is a trigger to
  // refetch, not something the query itself reads.
  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const partSearch = useCallback(async (q: string): Promise<SearchOption[]> => {
    const found = await searchParts(q);
    return found.map((p) => ({
      id: p.id,
      label: `SKU ${p.sku} — ${p.description}`,
    }));
  }, []);

  const patchBin = useCallback(
    async (locationId: string, patch: Record<string, unknown>) => {
      setError(null);
      setSavingId(locationId);
      try {
        await adminPatch("/api/admin/locations", {
          location_id: locationId,
          ...patch,
        });
        setRenamingId(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update bin.");
      } finally {
        setSavingId(null);
      }
    },
    [load],
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={card}>
      <h3 className="font-bold text-steel-900 dark:text-steel-50">Bins</h3>
      <p className="mt-1 text-sm text-steel-600 dark:text-steel-400">
        Click an item number to change it. Renaming one means reprinting that
        bin&apos;s label.
      </p>
      {error && <p className="mt-2 text-sm text-stock-none">{error}</p>}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search bins by item no.…"
        aria-label="Search bins"
        className={`${input} mt-3`}
      />
      <p className="mt-2 text-sm text-steel-500 dark:text-steel-400">
        {loading
          ? "Loading…"
          : `${total.toLocaleString()} bin${total === 1 ? "" : "s"}`}
      </p>
      <ul className="mt-2 divide-y divide-steel-100 dark:divide-steel-800">
        {rows.map((l) => (
          <li
            key={l.id}
            className="flex flex-wrap items-center justify-between gap-3 py-2.5"
          >
            {renamingId === l.id ? (
              <BinRename
                current={l.barcode_code}
                busy={savingId === l.id}
                onCancel={() => setRenamingId(null)}
                onSave={(next) => void patchBin(l.id, { barcode_code: next })}
              />
            ) : (
              <button
                type="button"
                onClick={() => setRenamingId(l.id)}
                title="Change this item number"
                className="font-mono text-[13px] tracking-tight text-steel-700 underline decoration-steel-300 decoration-dotted underline-offset-4 transition-colors hover:text-steel-950 hover:decoration-brand dark:text-steel-300 dark:hover:text-steel-50"
              >
                {l.barcode_code}
              </button>
            )}
            <div className="w-72 max-w-full">
              <SearchSelect
                search={partSearch}
                value={l.part_id}
                selectedLabel={l.partLabel}
                onChange={(partId) => void patchBin(l.id, { part_id: partId })}
                placeholder={savingId === l.id ? "Saving…" : "— empty —"}
              />
            </div>
          </li>
        ))}
        {!loading && rows.length === 0 && (
          <li className="py-3 text-sm text-steel-500 dark:text-steel-400">
            No bins match that search.
          </li>
        )}
      </ul>
      {total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className={buttonSecondary}
          >
            ← Previous
          </button>
          <span className="text-steel-500 dark:text-steel-400">
            Page {(page + 1).toLocaleString()} of {pageCount.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= pageCount || loading}
            className={buttonSecondary}
          >
            Next page →
          </button>
        </div>
      )}
    </div>
  );
}

function BinRename({
  current,
  busy,
  onSave,
  onCancel,
}: {
  current: string;
  busy: boolean;
  onSave: (next: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(current);
  const next = value.trim();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && next && next !== current) onSave(next);
          if (e.key === "Escape") onCancel();
        }}
        aria-label="Item number"
        className="w-44 rounded border border-steel-300 bg-white px-2 py-1 font-mono text-[13px] tracking-tight outline-none focus:border-brand dark:border-steel-700 dark:bg-steel-950"
      />
      <button
        type="button"
        onClick={() => onSave(next)}
        disabled={busy || !next || next === current}
        className={buttonSmall}
      >
        {busy ? "…" : "Save"}
      </button>
      <button type="button" onClick={onCancel} className={buttonSmall}>
        Cancel
      </button>
    </div>
  );
}
