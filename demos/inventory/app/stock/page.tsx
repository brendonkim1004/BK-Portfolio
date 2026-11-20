"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { adminGet, adminPatch, adminPost, useAdminSession } from "@/lib/adminApi";
import { InlineStockEditor } from "@/components/InlineStockEditor";
import { TEST_ITEM_CODE } from "@/lib/types";
import type { PartStockListRow } from "@/lib/types";
import {
  buttonSecondary,
  buttonSmall,
  pageTitle,
  tableHead,
} from "@/components/admin/formStyles";

type SortKey = "item_no" | "description" | "total_quantity";
type SortDir = "asc" | "desc";

// One page of rows. The catalog is thousands of parts; we fetch a page at a
// time from part_stock_list and let Postgres do the sorting and searching, so
// the browser never holds (or renders) the whole catalog.
const PAGE_SIZE = 100;

const COLUMNS = "part_id, sku, description, counted, total_quantity, item_no";

// PostgREST filter strings are comma/parenthesis delimited and use * as the
// ilike wildcard, so those characters can't be passed through from the search
// box verbatim.
function sanitize(q: string): string {
  return q.replace(/[,()*\\%]/g, " ").trim();
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={`h-[18px] w-[18px] ${filled ? "text-brand" : "text-steel-400"}`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinejoin="round"
        d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.9l-4.95 2.6.94-5.5-4-3.9 5.53-.8L10 1.6z"
      />
    </svg>
  );
}

export default function StockPage() {
  const [rows, setRows] = useState<PartStockListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  // The scanner-test item is pinned above the list on every page, so it is
  // fetched on its own and excluded from the paged query.
  const [testRow, setTestRow] = useState<PartStockListRow | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]); // ordered part_ids
  const [favRows, setFavRows] = useState<Record<string, PartStockListRow>>({});
  const [editingFavs, setEditingFavs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // debounced `search`
  const [sortKey, setSortKey] = useState<SortKey>("item_no");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [loadError, setLoadError] = useState<string | null>(null);
  // Editing from this table is available to anyone signed in — the same
  // session the /admin page uses. The routes behind each edit check it again.
  const { user } = useAdminSession();
  const adminMode = Boolean(user);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Bumped whenever a realtime event lands, so the favorites panel refreshes
  // with the table without re-querying on every page turn.
  const [dataVersion, setDataVersion] = useState(0);

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragIndex = useRef<number | null>(null);

  // Typing shouldn't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // A new search or sort always starts back at page 1.
  useEffect(() => {
    setPage(0);
  }, [query, sortKey, sortDir]);

  const loadPage = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    let q = supabase
      .from("part_stock_list")
      .select(COLUMNS, { count: "exact" })
      // `item_no <> 'TEST-ITEM'` alone would also drop parts with no bin,
      // since the comparison is NULL for them.
      .or(`item_no.is.null,item_no.neq.${TEST_ITEM_CODE}`);

    const term = sanitize(query);
    if (term) {
      q = q.or(`item_no.ilike.*${term}*,description.ilike.*${term}*`);
    }

    const ascending = sortDir === "asc";
    const { data, count, error } = await q
      .order(sortKey, { ascending, nullsFirst: false })
      // Stable tiebreaker so page boundaries don't shuffle between requests.
      .order("part_id", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (error) {
      setLoadError(error.message);
      setRows([]);
    } else {
      setLoadError(null);
      setRows((data ?? []) as unknown as PartStockListRow[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [query, sortKey, sortDir, page]);

  const loadTestRow = useCallback(async () => {
    const { data } = await getSupabaseBrowserClient()
      .from("part_stock_list")
      .select(COLUMNS)
      .eq("item_no", TEST_ITEM_CODE)
      .maybeSingle();
    setTestRow((data as unknown as PartStockListRow) ?? null);
  }, []);

  // Favorites belong to an account (migration 0017), so anon can no longer
  // read the table and they are fetched through the authenticated route.
  // Signed out, there is nobody to have favorites: the list stays empty and
  // the star is not offered.
  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      return;
    }
    try {
      const { part_ids } = await adminGet<{ part_ids: string[] }>(
        "/api/admin/favorites",
      );
      setFavorites(part_ids);
    } catch {
      // A failed load must not empty a list the person has actually got, so
      // this leaves the previous state alone rather than clearing it.
    }
  }, [user]);

  // Favorites can sit on any page, so they're fetched by id rather than read
  // out of the current page.
  useEffect(() => {
    if (favorites.length === 0) {
      setFavRows({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await getSupabaseBrowserClient()
        .from("part_stock_list")
        .select(COLUMNS)
        .in("part_id", favorites);
      if (cancelled) return;
      const map: Record<string, PartStockListRow> = {};
      for (const r of (data ?? []) as unknown as PartStockListRow[]) {
        map[r.part_id] = r;
      }
      setFavRows(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [favorites, dataVersion]);

  useEffect(() => {
    setLoading(true);
    void loadPage();
  }, [loadPage]);

  // Coalesce bursts of realtime events (e.g. rapid scans) into one refetch.
  // Held in a ref so turning the page or changing the sort doesn't tear down
  // and re-subscribe the realtime channel.
  const refetchRef = useRef<() => void>(() => {});
  useEffect(() => {
    refetchRef.current = () => {
      void loadPage();
      void loadTestRow();
    };
  }, [loadPage, loadTestRow]);
  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      refetchRef.current();
      setDataVersion((v) => v + 1);
    }, 250);
  }, []);

  // Its own effect, because loadFavorites now depends on who is signed in:
  // leaving it in the realtime effect below would tear down and rebuild the
  // whole subscription every time somebody signs in or out.
  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    void loadTestRow();

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("stock-totals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock" },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parts" },
        scheduleRefetch,
      )
      // item_no comes from the part's bin, so renaming, attaching or detaching
      // a bin changes this table even though no part or stock row moved.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "locations" },
        scheduleRefetch,
      )
      // No favorites subscription: the list is now one person's, so there is
      // no other browser to stay in step with, and migration 0017 removed the
      // table from the realtime publication along with anon's read.
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [scheduleRefetch, loadTestRow]);

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const toggleFavorite = useCallback(
    (partId: string) => {
      if (!user) return;
      const on = !favSet.has(partId);
      // Optimistic, then reconciled from the server: without realtime the
      // round trip is the only thing that would otherwise confirm it.
      setFavorites((prev) =>
        on ? [...prev, partId] : prev.filter((id) => id !== partId),
      );
      void adminPost("/api/admin/favorites", { part_id: partId, on })
        .catch(() => loadFavorites());
    },
    [favSet, user, loadFavorites],
  );

  const handleDrop = useCallback((to: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === to) return;
    setFavorites((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      void adminPatch("/api/admin/favorites", { part_ids: next })
        .catch(() => loadFavorites());
      return next;
    });
  }, [loadFavorites]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastShown = Math.min(total, page * PAGE_SIZE + rows.length);

  const arrow = (key: SortKey) =>
    key === sortKey ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const renderQuantity = (r: PartStockListRow) => {
    if (!r.counted) {
      return (
        <span
          title="Not in the Final Inventory Count"
          className="text-steel-400 dark:text-steel-500"
        >
          N/A
        </span>
      );
    }
    // Zero is marked but not alarmed. The SAGE import added 2,942 catalogue
    // entries that have never been counted in, so most of this table is
    // legitimately at zero — painting every one of them red would make the
    // colour mean nothing and the list unreadable. An outline is enough to
    // pick them out while scrolling.
    if (r.total_quantity === 0) {
      return (
        <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded border border-steel-300 px-1.5 py-0.5 text-[13px] font-semibold text-steel-500 dark:border-steel-600 dark:text-steel-400">
          0
        </span>
      );
    }
    return (
      <span className="font-semibold text-steel-900 dark:text-steel-100">
        {r.total_quantity}
      </span>
    );
  };

  const renderRow = (r: PartStockListRow) => {
    const isOpen = expanded === r.part_id;
    const fav = favSet.has(r.part_id);
    return (
      <Fragment key={r.part_id}>
        <tr
          onClick={
            adminMode ? () => setExpanded(isOpen ? null : r.part_id) : undefined
          }
          className={`group transition-colors hover:bg-steel-50 dark:hover:bg-steel-800/50 ${
            adminMode ? "cursor-pointer" : ""
          } ${isOpen ? "bg-steel-50 dark:bg-steel-800/50" : ""}`}
        >
          {/* Favorites are per-account now, so there is nothing to star when
              nobody is signed in. The cell stays so the columns still line up. */}
          <td className="py-2 pl-3 pr-1">
            {user && (
              <button
                type="button"
                aria-label={fav ? "Remove from favourites" : "Add to favourites"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(r.part_id);
                }}
                className={
                  fav
                    ? ""
                    : "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                }
              >
                <Star filled={fav} />
              </button>
            )}
          </td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-[13px] tracking-tight text-steel-700 dark:text-steel-300">
            {r.item_no ?? "—"}
          </td>
          <td className="px-3 py-2 text-steel-800 dark:text-steel-200">
            {r.description}
          </td>
          <td className="px-4 py-2 text-right tabular-nums">
            {renderQuantity(r)}
          </td>
        </tr>
        {adminMode && isOpen && (
          <tr>
            <td
              colSpan={4}
              className="border-l-2 border-brand bg-steel-50 px-4 py-4 dark:bg-steel-800/50"
            >
              <InlineStockEditor
                partId={r.part_id}
                description={r.description}
                itemNo={r.item_no}
                onChanged={scheduleRefetch}
                onDeleted={() => {
                  setExpanded(null);
                  scheduleRefetch();
                }}
              />
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Live stock</h1>
          {!loading && (
            <p className="mt-1 text-sm text-steel-500 dark:text-steel-400">
              {total.toLocaleString()} item{total === 1 ? "" : "s"}
              {total > 0 && (
                <>
                  {" · showing "}
                  {firstShown.toLocaleString()}–{lastShown.toLocaleString()}
                </>
              )}
            </p>
          )}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item no. or description"
          aria-label="Search stock"
          className="w-full rounded-md border border-steel-300 bg-white px-3 py-2 text-sm text-steel-900 outline-none transition-colors placeholder:text-steel-400 focus:border-steel-500 sm:w-72 dark:border-steel-700 dark:bg-steel-900 dark:text-steel-100"
        />
      </div>

      {adminMode ? (
        <p className="mt-3 flex items-center gap-2 border-l-2 border-brand pl-3 text-sm text-steel-700 dark:text-steel-300">
          Signed in as {user?.display_name} — click any row to rename it,
          manage its bins and stock, or delete it. Every change is recorded.
        </p>
      ) : (
        <p className="mt-3 border-l-2 border-steel-300 pl-3 text-sm text-steel-500 dark:border-steel-700 dark:text-steel-400">
          Read only.{" "}
          <Link
            href="/admin"
            className="font-semibold text-steel-800 underline decoration-brand decoration-2 underline-offset-2 dark:text-steel-200"
          >
            Sign in
          </Link>{" "}
          to edit from this table.
        </p>
      )}

      {favorites.length > 0 && (
        <div className="mt-5 rounded-lg border border-steel-200 bg-white p-4 dark:border-steel-800 dark:bg-steel-900">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Star filled /> Favorites
            </h2>
            <button
              type="button"
              onClick={() => setEditingFavs((v) => !v)}
              className={buttonSmall}
            >
              {editingFavs ? "Done" : "Edit"}
            </button>
          </div>
          <ul className="mt-3 divide-y divide-steel-100 dark:divide-steel-800">
            {favorites.map((partId, i) => {
              const r = favRows[partId];
              return (
                <li
                  key={partId}
                  draggable={editingFavs}
                  onDragStart={() => {
                    dragIndex.current = i;
                  }}
                  onDragOver={
                    editingFavs ? (e) => e.preventDefault() : undefined
                  }
                  onDrop={editingFavs ? () => handleDrop(i) : undefined}
                  className={`flex items-center gap-3 py-2 text-sm ${
                    editingFavs ? "cursor-move" : ""
                  }`}
                >
                  {editingFavs && <span className="text-steel-400">⠿</span>}
                  <span className="w-28 shrink-0 font-mono text-[13px] tracking-tight text-steel-500 dark:text-steel-400">
                    {r?.item_no ?? "—"}
                  </span>
                  <span className="flex-1 truncate">
                    {r?.description ?? "…"}
                  </span>
                  <span
                    className={
                      r && !r.counted
                        ? "text-steel-400 dark:text-steel-500"
                        : "font-semibold"
                    }
                  >
                    {!r ? "—" : r.counted ? r.total_quantity : "N/A"}
                  </span>
                  {editingFavs && (
                    <button
                      type="button"
                      onClick={() => toggleFavorite(partId)}
                      aria-label="Remove favorite"
                      className="px-1 text-steel-400 transition-colors hover:text-stock-none"
                    >
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {editingFavs && (
            <p className="mt-2 text-xs text-steel-500 dark:text-steel-400">
              Drag to reorder · × to remove
            </p>
          )}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-steel-200 bg-white dark:border-steel-800 dark:bg-steel-900">
        <table className="w-full text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="w-9 py-2 pl-3 pr-1" aria-label="Favourite" />
              <th className="px-3 py-2">
                <button onClick={() => toggleSort("item_no")}>
                  Item no.{arrow("item_no")}
                </button>
              </th>
              <th className="px-3 py-2">
                <button onClick={() => toggleSort("description")}>
                  Description{arrow("description")}
                </button>
              </th>
              <th className="px-4 py-2 text-right">
                <button onClick={() => toggleSort("total_quantity")}>
                  Qty{arrow("total_quantity")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-steel-100 dark:divide-steel-800">
            {testRow && renderRow(testRow)}
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-steel-500 dark:text-steel-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && loadError && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-stock-none">
                  Couldn&apos;t load the stock list: {loadError}
                </td>
              </tr>
            )}
            {!loading && !loadError && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-steel-500 dark:text-steel-400">
                  No parts match that search.
                </td>
              </tr>
            )}
            {!loading && !loadError && rows.map(renderRow)}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
          className={buttonSecondary}
        >
          ← Previous
        </button>
        <span className="text-sm text-steel-500 dark:text-steel-400">
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
    </div>
  );
}
