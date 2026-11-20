"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { adminGet, useAdminSession } from "@/lib/adminApi";
import { SignInForm } from "@/components/admin/SignInForm";
import {
  buttonSecondary,
  buttonSmall,
  input,
  label,
  pageTitle,
  tableHead,
} from "@/components/admin/formStyles";
import type { AuditLogRow } from "@/lib/types";

const PAGE_SIZE = 50;

type ActivityResponse = {
  rows: AuditLogRow[];
  total: number;
  offset: number;
  limit: number;
  actors?: { id: string; name: string }[];
};

// "11 Sep, 18:04" — the log is read to reconstruct a recent afternoon, so the
// time of day matters more than the year.
function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityPage() {
  const { user, ready, refresh } = useAdminSession();

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [actors, setActors] = useState<{ id: string; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [actorId, setActorId] = useState("");
  const [itemNo, setItemNo] = useState("");
  const [query, setQuery] = useState(""); // debounced `itemNo`
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Typing an item number should not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(itemNo.trim()), 250);
    return () => clearTimeout(t);
  }, [itemNo]);

  // Changing a filter puts you back on the first page; staying on page 4 of a
  // different result set is never what anyone meant.
  useEffect(() => setOffset(0), [actorId, query]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(PAGE_SIZE),
      });
      if (actorId) params.set("actor_id", actorId);
      if (query) params.set("item_no", query);

      const data = await adminGet<ActivityResponse>(
        `/api/admin/activity?${params.toString()}`,
      );
      setRows(data.rows);
      setTotal(data.total);
      // Only the first page carries the list of people; keep the one we have
      // while paging so the filter does not empty itself.
      if (data.actors) setActors(data.actors);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activity.");
    } finally {
      setLoading(false);
    }
  }, [user, offset, actorId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-steel-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <SignInForm onSignedIn={refresh} />
      </div>
    );
  }

  const showing = rows.length;
  const from = total === 0 ? 0 : offset + 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Activity</h1>
          <p className="mt-1 text-sm text-steel-500 dark:text-steel-400">
            Every change made through the admin tools, newest first.
          </p>
        </div>
        <Link href="/admin" className={buttonSecondary}>
          Back to admin
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className={label} htmlFor="actor">
            Person
          </label>
          <select
            id="actor"
            className={`${input} sm:w-48`}
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
          >
            <option value="">Everyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="item">
            Item number
          </label>
          <input
            id="item"
            className={`${input} font-mono sm:w-56`}
            value={itemNo}
            onChange={(e) => setItemNo(e.target.value)}
            placeholder="Any part of the number"
          />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-stock-none">{error}</p>}

      <div className="mt-5 overflow-x-auto rounded-lg border border-steel-200 dark:border-steel-800">
        <table className="w-full text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="px-3 py-2">Who</th>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">What</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-steel-200 dark:divide-steel-800">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-steel-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-steel-500">
                  Nothing recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const open = expanded === r.id;
                const hasDetails = r.details !== null;
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={
                        hasDetails
                          ? () => setExpanded(open ? null : r.id)
                          : undefined
                      }
                      className={hasDetails ? "cursor-pointer" : ""}
                    >
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">
                        {r.actor_name}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-steel-500 dark:text-steel-400">
                        {when(r.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        {hasDetails && (
                          <span aria-hidden className="mr-1.5 text-steel-400">
                            {open ? "▾" : "▸"}
                          </span>
                        )}
                        {r.summary}
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-steel-50 dark:bg-steel-900">
                        <td colSpan={3} className="px-3 py-2">
                          <pre className="overflow-x-auto font-mono text-[12px] text-steel-600 dark:text-steel-400">
                            {JSON.stringify(r.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-steel-500 dark:text-steel-400">
        <span>
          {total === 0
            ? "No entries"
            : `${from}–${offset + showing} of ${total.toLocaleString()}`}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className={buttonSmall}
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Newer
          </button>
          <button
            type="button"
            className={buttonSmall}
            disabled={offset + showing >= total || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Older
          </button>
        </div>
      </div>
    </div>
  );
}
