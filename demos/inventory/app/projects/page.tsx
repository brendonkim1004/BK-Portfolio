"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { adminPost, useAdminSession } from "@/lib/adminApi";
import { Barcode } from "@/components/Barcode";
import { card, input, label, button, buttonSecondary } from "@/components/admin/formStyles";
import { PROJECT_DONE_CODE } from "@/lib/types";
import type { Project, ProjectUsageRow } from "@/lib/types";

// Print isolation: in a "solo" mode we hide every printable block except the
// target; in "codes" mode we hide the usage tables and the Done lists so only
// the barcodes print.
function printCss(mode: string | null): string {
  if (!mode) return "";
  if (mode === "codes") {
    return `@media print { [data-usage], [data-print="done-list"], [data-print="usage-all"] { display: none !important; } }`;
  }
  return `@media print { [data-print]:not([data-print="${mode}"]) { display: none !important; } }`;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [generalId, setGeneralId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [printMode, setPrintMode] = useState<string | null>(null);
  // The project behind a single-barcode print. The label needs the name and
  // number, not just the code, so the printed sheet is identifiable off the
  // wall without scanning it.
  const [printProject, setPrintProject] = useState<Project | null>(null);
  const [openDone, setOpenDone] = useState(false);
  const [openAll, setOpenAll] = useState(false);
  // Seeded empty and filled on mount rather than read during render, so the
  // server-rendered markup and the first client render agree.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [openArchived, setOpenArchived] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("projects")
      .select("id, number, code, name, created_at, archived")
      .order("number", { ascending: false });
    const all = (data ?? []) as Project[];
    setGeneralId(all.find((p) => p.code === PROJECT_DONE_CODE)?.id ?? null);
    const real = all.filter((p) => p.code !== PROJECT_DONE_CODE);
    setProjects(real.filter((p) => !p.archived));
    setArchivedProjects(real.filter((p) => p.archived));
    setLoading(false);
  }, []);

  const archiveProject = useCallback(
    async (id: string, archived: boolean) => {
      await getSupabaseBrowserClient().rpc("set_project_archived", {
        p_project_id: id,
        p_archived: archived,
      });
      void refetch();
    },
    [refetch],
  );

  useEffect(() => {
    void refetch();
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("projects-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => {
          void refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Trigger the browser print dialog once the targeted blocks have rendered.
  useEffect(() => {
    if (!printMode) return;
    const reset = () => setPrintMode(null);
    window.addEventListener("afterprint", reset, { once: true });
    const t = setTimeout(() => window.print(), 60);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", reset);
    };
  }, [printMode]);

  const printRegion = (key: string) => setPrintMode(key);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const toggleCollapsed = useCallback((projectId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      writeCollapsed(next);
      return next;
    });
  }, []);

  const printProjectBarcode = (project: Project) => {
    setPrintProject(project);
    setPrintMode("single-code");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <style>{printCss(printMode)}</style>

      {/* Top-level print-only block for a single project barcode. Kept out of
          any card so it prints even when that card is hidden or archived. */}
      {printMode === "single-code" && printProject && (
        <div
          data-print="single-code"
          className="hidden flex-col items-center py-8 text-center print:flex"
        >
          <div className="text-2xl font-semibold">
            Project {printProject.number} — {printProject.name}
          </div>
          <div className="mt-6">
            <Barcode value={printProject.code} width={3} height={110} />
          </div>
          <div className="mt-2 font-mono text-sm">{printProject.code}</div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-steel-600 dark:text-steel-400">
            Create a project to get a barcode. Scan it on the Scan page, then
            every part you scan is logged to that project.
          </p>
        </div>
        <button
          type="button"
          onClick={() => printRegion("codes")}
          className={`${buttonSecondary} shrink-0`}
        >
          Print all codes
        </button>
      </div>

      <div className="mt-6 print:hidden">
        <CreateProjectForm />
      </div>

      {/* Reserved Done barcode + the two tracking lists. */}
      <div
        data-print="done-code"
        className={`mt-6 flex flex-col items-center text-center ${card}`}
      >
        <div className="text-[13px] font-bold text-steel-600 dark:text-steel-400">
          Exit-project label
        </div>
        <p className="mt-1 mb-3 max-w-md text-sm text-steel-600 dark:text-steel-400">
          Print this once and keep it at the scanning station. Scanning it ends
          project mode; parts scanned outside a project are tracked below.
        </p>
        <Barcode value={PROJECT_DONE_CODE} />
      </div>

      <div data-print="done-list" className={`mt-4 ${card}`}>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpenDone((v) => !v)}
            className="flex items-center gap-2 text-left font-semibold"
          >
            <span className="text-steel-400">{openDone ? "▾" : "▸"}</span>
            Items scanned (General / Done)
          </button>
          <div className="flex items-center gap-2 print:hidden">
            <ClearControl
              onClear={async () => {
                if (!generalId) return;
                await adminPost("/api/admin/logs/clear-project", {
                  project_id: generalId,
                });
              }}
            />
            <button
              type="button"
              onClick={() => {
                setOpenDone(true);
                printRegion("done-list");
              }}
              className={buttonSecondary}
            >
              Print
            </button>
          </div>
        </div>
        {openDone &&
          (generalId ? (
            <div className="mt-3">
              <ProjectUsagePanel projectId={generalId} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-steel-500">
              The General/Done bucket isn’t set up yet (run migration 0003).
            </p>
          ))}
      </div>

      <div data-print="usage-all" className={`mt-4 ${card}`}>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpenAll((v) => !v)}
            className="flex items-center gap-2 text-left font-semibold"
          >
            <span className="text-steel-400">{openAll ? "▾" : "▸"}</span>
            All items scanned into projects
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenAll(true);
              printRegion("usage-all");
            }}
            className={buttonSecondary}
          >
            Print
          </button>
        </div>
        {openAll && (
          <div className="mt-3">
            <AllProjectUsage />
          </div>
        )}
      </div>

      {loading ? (
        <p className="mt-6 text-steel-500">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="mt-6 text-steel-500">No active projects.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              collapsed={collapsed.has(project.id)}
              onToggleCollapsed={() => toggleCollapsed(project.id)}
              onPrintBarcode={() => printProjectBarcode(project)}
              onPrintUsed={() => printRegion(`project-${project.id}`)}
              onArchiveToggle={() => archiveProject(project.id, true)}
              onRenamed={() => void refetch()}
            />
          ))}
        </div>
      )}

      {archivedProjects.length > 0 && (
        <div className="mt-8 print:hidden">
          <button
            type="button"
            onClick={() => setOpenArchived((v) => !v)}
            className="flex items-center gap-2 font-semibold text-steel-600 dark:text-steel-300"
          >
            <span className="text-steel-400">{openArchived ? "▾" : "▸"}</span>
            Archived ({archivedProjects.length})
          </button>
          {openArchived && (
            <div className="mt-4 space-y-4">
              {archivedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  archived
                  collapsed={collapsed.has(project.id)}
                  onToggleCollapsed={() => toggleCollapsed(project.id)}
                  onPrintBarcode={() => printProjectBarcode(project)}
                  onArchiveToggle={() => archiveProject(project.id, false)}
                  onRenamed={() => void refetch()}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateProjectForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setMsg({ ok: false, text: "Enter a project name." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("create_project", {
      p_name: trimmed,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as Project | undefined;
    setName("");
    setMsg({
      ok: true,
      text: row ? `Created ${row.code} — ${row.name}` : "Project created.",
    });
  }

  return (
    <form onSubmit={submit} className={card}>
      <label htmlFor="project-name" className={label}>
        New project name
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. North Tower Pump Rebuild"
          className={`${input} mt-0 flex-1`}
        />
        <button type="submit" disabled={busy} className={button}>
          {busy ? "…" : "Create"}
        </button>
      </div>
      {msg && (
        <p
          className={`mt-2 text-sm ${
            msg.ok
              ? "text-stock-ok"
              : "text-stock-none"
          }`}
        >
          {msg.text}
        </p>
      )}
    </form>
  );
}

// Which project cards are collapsed, remembered across reloads.
//
// Stored as the ids that ARE collapsed, so a project created later starts
// expanded — the opposite (storing the expanded ones) would silently hide
// every new project. Per browser, so the shop computer and a laptop keep
// their own view; that is the accepted cost of not putting it in the database.
const COLLAPSED_KEY = "concord_projects_collapsed";

function readCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? new Set(ids.filter((v) => typeof v === "string")) : new Set();
  } catch {
    // Unparseable or unavailable storage means "nothing collapsed", which is
    // the state the page had before any of this existed.
    return new Set();
  }
}

function writeCollapsed(ids: Set<string>): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    // Private browsing and blocked site data throw here. Losing the preference
    // is not worth failing the interaction over.
  }
}

function ProjectCard({
  project,
  archived = false,
  collapsed,
  onToggleCollapsed,
  onPrintBarcode,
  onPrintUsed,
  onArchiveToggle,
  onRenamed,
}: {
  project: Project;
  archived?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onPrintBarcode: () => void;
  onPrintUsed?: () => void;
  onArchiveToggle: () => void;
  onRenamed: () => void;
}) {
  // Renaming is the one edit a project allows, and only for a signed-in
  // account: the number and code are printed on labels in the shop, so they
  // stay fixed, while the name is just how people recognise the job.
  const { user } = useAdminSession();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function cancelRename() {
    setDraft(project.name);
    setNote(null);
    setEditing(false);
  }

  async function saveName() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setNote("Enter a project name.");
      return;
    }
    if (trimmed === project.name) {
      cancelRename();
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await adminPost<{ warning?: string }>(
        "/api/admin/projects",
        { project_id: project.id, name: trimmed },
      );
      setEditing(false);
      // A warning means the rename stuck but the activity log did not record
      // it, so it stays on screen rather than disappearing with the form.
      setNote(res.warning ?? null);
      onRenamed();
    } catch (err) {
      // Stay open on failure, so the typed name is not lost.
      setNote(err instanceof Error ? err.message : "Could not rename.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-print={`project-${project.id}`} className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveName();
              }}
              className="flex flex-wrap items-center gap-2 print:hidden"
            >
              <span className="text-lg font-semibold">
                Project {project.number} —
              </span>
              <input
                autoFocus
                aria-label={`Name for project ${project.number}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelRename();
                }}
                /* Same cap the route enforces, so the limit is felt in the
                   field rather than reported after a failed save. */
                maxLength={120}
                className={`${input} max-w-xs`}
              />
              <button type="submit" disabled={busy} className={button}>
                {busy ? "…" : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelRename}
                className={buttonSecondary}
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {/* Same control as "All items scanned into projects", so the two
                  collapsing things on this page work identically. */}
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-expanded={!collapsed}
                className="flex items-center gap-2 text-left text-lg font-semibold"
              >
                <span className="text-steel-400">{collapsed ? "▸" : "▾"}</span>
                <h2>
                  Project {project.number} — {project.name}
                </h2>
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(project.name);
                    setNote(null);
                    setEditing(true);
                  }}
                  className="rounded-md px-2 py-1 text-sm text-steel-500 underline decoration-dotted underline-offset-2 hover:text-steel-900 print:hidden dark:hover:text-steel-100"
                >
                  Rename
                </button>
              )}
            </div>
          )}
          {note && (
            <p className="mt-1 text-sm text-stock-none print:hidden">{note}</p>
          )}
          {!collapsed && (
            <p className="mt-1 text-sm text-steel-500">
              Scan <span className="font-mono">{project.code}</span> to log
              parts here.
            </p>
          )}
        </div>
        {/* The barcode and its buttons go with the body. A collapsed card is
            a name and nothing else, which is the point of collapsing it — and
            it means "Print items" cannot be pressed while the region it would
            print is unrendered. */}
        <div className={`flex flex-col items-center gap-2 ${collapsed ? "hidden" : ""}`}>
          <Barcode value={project.code} />
          <div className="flex flex-wrap justify-center gap-2 print:hidden">
            <button
              type="button"
              onClick={onPrintBarcode}
              className={buttonSecondary}
            >
              Print barcode
            </button>
            {!archived && onPrintUsed && (
              <button
                type="button"
                onClick={onPrintUsed}
                className={buttonSecondary}
              >
                Print items
              </button>
            )}
            <button
              type="button"
              onClick={onArchiveToggle}
              className={buttonSecondary}
            >
              {archived ? "Restore" : "Done"}
            </button>
          </div>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-4">
          <ProjectUsagePanel projectId={project.id} />
        </div>
      )}
    </div>
  );
}

// Self-loading, editable usage table for one project (used by project cards and
// the General/Done section). Rows edit via set_project_usage (also moves stock).
function ProjectUsagePanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<ProjectUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("project_usage")
      .select("part_id, quantity, parts(description, locations(barcode_code))")
      .eq("project_id", projectId);
    const mapped = (data ?? []).map((r) => {
      const parts = r.parts as unknown as {
        description: string;
        locations: { barcode_code: string }[];
      } | null;
      return {
        part_id: r.part_id as string,
        item_no: parts?.locations?.[0]?.barcode_code ?? "—",
        description: parts?.description ?? "(unknown part)",
        quantity: r.quantity as number,
      };
    });
    mapped.sort((a, b) => a.item_no.localeCompare(b.item_no));
    setRows(mapped);
    setLoading(false);
  }, [projectId]);

  const scheduleLoad = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(load, 250);
  }, [load]);

  useEffect(() => {
    void load();
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`project-usage-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_usage",
          filter: `project_id=eq.${projectId}`,
        },
        scheduleLoad,
      )
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [load, scheduleLoad, projectId]);

  return (
    <div
      data-usage
      className="overflow-x-auto rounded-lg border border-steel-200 dark:border-steel-800"
    >
      <table className="w-full text-left text-sm">
        <thead className="bg-steel-100 text-steel-600 dark:bg-steel-900 dark:text-steel-400">
          <tr>
            <th className="px-3 py-2">Part #</th>
            <th className="px-3 py-2">Part name</th>
            <th className="px-3 py-2 text-right">Qty used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-steel-200 dark:divide-steel-800">
          {loading && (
            <tr>
              <td colSpan={3} className="px-3 py-4 text-center text-steel-500">
                Loading…
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-4 text-center text-steel-500">
                Nothing scanned here yet.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <UsageRow
              key={row.part_id}
              projectId={projectId}
              row={row}
              onChanged={load}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsageRow({
  projectId,
  row,
  onChanged,
}: {
  projectId: string;
  row: ProjectUsageRow;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.quantity));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save() {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      setNote("Whole number ≥ 0.");
      return;
    }
    setBusy(true);
    setNote(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("set_project_usage", {
      p_project_id: projectId,
      p_part_id: row.part_id,
      p_quantity: n,
    });
    setBusy(false);
    if (error) {
      setNote(error.message);
      return;
    }
    setEditing(false);
    onChanged();
  }

  return (
    <tr>
      <td className="px-3 py-2 font-mono">{row.item_no}</td>
      <td className="px-3 py-2">{row.description}</td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <span className="inline-flex items-center gap-2 print:hidden">
            {note && (
              <span className="text-xs text-stock-none">
                {note}
              </span>
            )}
            <input
              type="number"
              min={0}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-20 rounded-md border border-steel-300 bg-white px-2 py-1 text-right dark:border-steel-700 dark:bg-steel-950"
            />
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-md border border-steel-300 px-2 py-1 font-medium hover:bg-steel-100 disabled:opacity-50 dark:border-steel-700 dark:hover:bg-steel-800"
            >
              {busy ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setValue(String(row.quantity));
                setNote(null);
                setEditing(false);
              }}
              className="rounded-md px-2 py-1 text-steel-500 hover:text-steel-900 dark:hover:text-steel-100"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setValue(String(row.quantity));
              setEditing(true);
            }}
            className="font-semibold underline decoration-dotted underline-offset-2 print:no-underline"
            title="Edit quantity (also adjusts stock)"
          >
            {row.quantity}
          </button>
        )}
      </td>
    </tr>
  );
}

// Confirm-guarded "Clear list" button used by both tracking lists.
// Clearing a list is a permanent delete of history. It used to be callable by
// anyone who could open this page — clear_scan_log() and clear_project_usage()
// were granted to anon until migration 0014 revoked them. Now it needs a
// signed-in admin, and the button is simply absent for everyone else.
function ClearControl({ onClear }: { onClear: () => Promise<void> }) {
  const { user } = useAdminSession();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  if (!confirming) {
    return (
      <button
        type="button"
        className={buttonSecondary}
        onClick={() => setConfirming(true)}
      >
        Clear list
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm text-steel-500">Clear?</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await onClear();
            setConfirming(false);
          } catch (err) {
            // Stay open on failure. Silently closing would look like the list
            // had been cleared when it had not.
            setError(err instanceof Error ? err.message : "Could not clear.");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-md bg-stock-none px-3 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "…" : "Confirm"}
      </button>
      <button
        type="button"
        className={buttonSecondary}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </button>
      {error && <span className="text-sm text-stock-none">{error}</span>}
    </span>
  );
}

// Read-only daily roll-up of items scanned into real projects, from the
// independent scan_log (so clearing it never touches the per-project cards).
// Sortable by project or by most recent, and clearable.
type AllUsageRow = {
  key: string;
  projectName: string;
  projectNumber: number;
  itemNo: string;
  description: string;
  quantity: number;
  latest: string;
};

const ALL_USAGE_CAP = 200;

function AllProjectUsage() {
  const [rows, setRows] = useState<AllUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"project" | "latest">("project");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const data = await fetchAllRows<{
      project_id: string;
      part_id: string;
      created_at: string;
      projects: { name: string; number: number; code: string } | null;
      parts: { description: string; locations: { barcode_code: string }[] } | null;
    }>(
      "scan_log",
      "project_id, part_id, created_at, projects(name, number, code), parts(description, locations(barcode_code))",
      { column: "created_at", ascending: false },
    );
    // Aggregate per (project, part): row count = qty used, max time = latest.
    const map = new Map<string, AllUsageRow>();
    for (const r of data) {
      if (!r.projects) continue;
      const key = `${r.project_id}-${r.part_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += 1;
        if (r.created_at > existing.latest) existing.latest = r.created_at;
      } else {
        map.set(key, {
          key,
          projectName: r.projects.name,
          projectNumber: r.projects.number,
          itemNo: r.parts?.locations?.[0]?.barcode_code ?? "—",
          description: r.parts?.description ?? "(unknown part)",
          quantity: 1,
          latest: r.created_at,
        });
      }
    }
    setRows([...map.values()]);
    setLoading(false);
  }, []);

  const scheduleLoad = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 300);
  }, [load]);

  useEffect(() => {
    void load();
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("all-project-usage")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scan_log" },
        scheduleLoad,
      )
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [load, scheduleLoad]);

  const shown = useMemo(() => {
    const arr = [...rows];
    if (sort === "latest") {
      arr.sort((a, b) => b.latest.localeCompare(a.latest));
    } else {
      arr.sort(
        (a, b) =>
          a.projectNumber - b.projectNumber || a.itemNo.localeCompare(b.itemNo),
      );
    }
    return arr.slice(0, ALL_USAGE_CAP);
  }, [rows, sort]);

  const tab = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium ${
      active
        ? "bg-steel-900 text-white dark:bg-white dark:text-steel-900"
        : "text-steel-600 hover:bg-steel-100 dark:text-steel-300 dark:hover:bg-steel-800"
    }`;

  return (
    <div data-usage>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="inline-flex overflow-hidden rounded-lg border border-steel-300 dark:border-steel-700">
          <button
            type="button"
            onClick={() => setSort("project")}
            className={tab(sort === "project")}
          >
            By project
          </button>
          <button
            type="button"
            onClick={() => setSort("latest")}
            className={tab(sort === "latest")}
          >
            Latest
          </button>
        </div>
        <ClearControl
          onClear={async () => {
            await adminPost("/api/admin/logs/clear-scans", {});
            await load();
          }}
        />
      </div>

      {loading ? (
        <p className="text-sm text-steel-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-steel-500">
          Nothing scanned into any project yet.
        </p>
      ) : (
        <>
          {rows.length > ALL_USAGE_CAP && (
            <p className="mb-2 text-sm text-steel-500">
              Showing the first {ALL_USAGE_CAP} of{" "}
              {rows.length.toLocaleString()} rows.
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-steel-200 dark:border-steel-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-steel-100 text-steel-600 dark:bg-steel-900 dark:text-steel-400">
                <tr>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Part #</th>
                  <th className="px-3 py-2">Part name</th>
                  <th className="px-3 py-2 text-right">Qty used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-200 dark:divide-steel-800">
                {shown.map((r) => (
                  <tr key={r.key}>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded border border-steel-300 bg-steel-50 px-1.5 py-0.5 text-xs font-semibold text-steel-700 dark:border-steel-600 dark:bg-steel-800 dark:text-steel-300">
                        {r.projectNumber} · {r.projectName}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">{r.itemNo}</td>
                    <td className="px-3 py-2">{r.description}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {r.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
