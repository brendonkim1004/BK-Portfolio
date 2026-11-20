"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchBins } from "@/lib/lookup";
import { button, buttonSecondary, pageTitle } from "@/components/admin/formStyles";
import { Barcode } from "@/components/Barcode";

type Bin = { id: string; barcode_code: string; description: string };

// Cap how many barcodes we render at once — the catalog can be thousands of
// items and drawing every Code128 SVG would lock up the browser.
const RENDER_CAP = 60;

export default function LabelsPage() {
  const [shown, setShown] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const q = search.trim();

  // This page shows nothing until something is typed, so there is nothing to
  // preload. It used to download every bin in the catalog on mount purely to
  // filter it in memory; now Postgres does the matching and returns only the
  // labels about to be drawn.
  useEffect(() => {
    if (!q) {
      setShown([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const bins = await searchBins(q, { limit: RENDER_CAP });
          if (cancelled) return;
          setShown(
            bins.map((b) => ({
              id: b.id,
              barcode_code: b.barcode_code,
              description: b.description ?? "",
            })),
          );
          setError(null);
        } catch (err) {
          if (cancelled) return;
          setShown([]);
          setError(err instanceof Error ? err.message : "Search failed.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className={pageTitle}>Bin labels</h1>
          <p className="mt-1 text-sm text-steel-600 dark:text-steel-400">
            Search by item number or description, then print the Code128 labels.
            Scannable by phone camera or an HID scanner.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className={buttonSecondary}
          >
            Back
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={shown.length === 0}
            className={button}
          >
            Print
          </button>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search item no. or description…"
        autoComplete="off"
        className="mt-4 w-full rounded-md border border-steel-300 bg-white px-4 py-2.5 text-[15px] outline-none transition-colors placeholder:text-steel-400 focus:border-brand dark:border-steel-700 dark:bg-steel-900 print:hidden"
      />

      {!q ? (
        <p className="mt-6 text-steel-500 print:hidden">
          Type an item number or description above to find labels to print.
        </p>
      ) : error ? (
        <p className="mt-6 text-sm text-stock-none">{error}</p>
      ) : loading ? (
        <p className="mt-6 text-steel-500">Searching…</p>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-steel-500">No items match “{search}”.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-steel-500 print:hidden">
            {shown.length === RENDER_CAP
              ? `Showing the first ${RENDER_CAP} matches — refine your search to narrow it down.`
              : `${shown.length} match${shown.length === 1 ? "" : "es"}.`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {shown.map((bin) => (
              <div
                key={bin.id}
                className="flex flex-col items-center rounded border border-steel-300 bg-white p-3 text-center dark:border-steel-700"
              >
                <Barcode value={bin.barcode_code} />
                <div className="mt-1 line-clamp-2 text-xs text-steel-600">
                  {bin.description || "unassigned"}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
