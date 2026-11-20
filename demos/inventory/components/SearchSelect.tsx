"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { input } from "@/components/admin/formStyles";

export type SearchOption = { id: string; label: string };

// A typeahead backed by a server-side search.
//
// It used to take the whole option list as a prop and filter it in memory,
// which meant every page using it first downloaded the entire catalog. Now it
// asks `search` for the matches, debounced, so the catalog can grow without the
// page getting slower. `selectedLabel` is what to show for the current value:
// the caller knows it, and we can't look it up in a list we no longer hold.
export function SearchSelect({
  search,
  value,
  selectedLabel,
  onChange,
  placeholder = "Search…",
  id,
}: {
  search: (query: string) => Promise<SearchOption[]>;
  value: string | null;
  selectedLabel?: string | null;
  onChange: (id: string | null, option: SearchOption | null) => void;
  placeholder?: string;
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<SearchOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the newest request may write to state — a slow early keystroke must
  // not overwrite the results of a later, more specific one.
  const requestId = useRef(0);

  const run = useCallback(
    async (q: string) => {
      const mine = ++requestId.current;
      setBusy(true);
      try {
        const found = await search(q);
        if (mine !== requestId.current) return;
        setMatches(found);
        setError(null);
      } catch (err) {
        if (mine !== requestId.current) return;
        setMatches([]);
        setError(err instanceof Error ? err.message : "Search failed.");
      } finally {
        if (mine === requestId.current) setBusy(false);
      }
    },
    [search],
  );

  // Debounce typing; the first open fires immediately so the list isn't blank.
  useEffect(() => {
    if (!open) return;
    if (query === "") {
      void run("");
      return;
    }
    const t = setTimeout(() => void run(query), 250);
    return () => clearTimeout(t);
  }, [open, query, run]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  return (
    <div className="relative">
      <input
        id={id}
        className={input}
        value={open ? query : selectedLabel ?? ""}
        placeholder={selectedLabel ?? placeholder}
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
      />
      {value && !open && (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => onChange(null, null)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-steel-400 hover:text-steel-700 dark:hover:text-steel-200"
        >
          ×
        </button>
      )}
      {open && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-steel-300 bg-white shadow-lg dark:border-steel-700 dark:bg-steel-900">
          {error ? (
            <li className="px-3 py-2 text-sm text-stock-none">
              {error}
            </li>
          ) : matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-steel-500">
              {busy ? "Searching…" : "No matches"}
            </li>
          ) : (
            matches.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  // Prevent the input's blur from firing before this click.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(o.id, o);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-steel-100 dark:hover:bg-steel-800 ${
                    o.id === value ? "bg-steel-100 dark:bg-steel-800" : ""
                  }`}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
