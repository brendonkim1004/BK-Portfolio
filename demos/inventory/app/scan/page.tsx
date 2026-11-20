"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DemoLabels } from "@/components/DemoLabels";
import { PROJECT_DONE_CODE, RESTOCK_MODE_CODE } from "@/lib/types";
import type { Project, UsePartResult } from "@/lib/types";
import {
  buttonSecondary,
  pageTitle,
  sectionTitle,
} from "@/components/admin/formStyles";

type ScanOutcome = {
  id: number;
  code: string;
  kind: "used" | "added" | "info" | "error";
  message: string;
  detail?: string;
  // Kept as a number rather than baked into `detail`: the resulting count is
  // what a scanner operator is actually checking, and it gets set at a size
  // that can be read at arm's length.
  quantity?: number;
};

function describeError(raw: string): string {
  if (raw.includes("UNKNOWN_BARCODE")) {
    return "Unknown barcode — no bin is registered for that code.";
  }
  if (raw.includes("EMPTY_BIN")) {
    return "This bin has no part assigned to it.";
  }
  if (raw.includes("OUT_OF_STOCK")) {
    return "Out of stock — scan blocked to keep quantity from going negative.";
  }
  if (raw.includes("UNKNOWN_PROJECT")) {
    return "That project no longer exists — exited project mode.";
  }
  return raw || "Something went wrong.";
}

// How each outcome presents: a colour edge, a one-word verdict, a tinted panel.
const RESULT = {
  used: {
    word: "Logged",
    edge: "bg-stock-ok",
    panel: "border-stock-ok/30 bg-[#f2f9f4] dark:bg-stock-ok/10",
    wordColor: "text-stock-ok",
  },
  // Both a use and a restock are successful scans, so both read green; the
  // verdict word and the count say which direction the stock moved. Red is
  // reserved for a refused scan, so it never means two things at once.
  added: {
    word: "Added",
    edge: "bg-stock-ok",
    panel: "border-stock-ok/30 bg-[#f2f9f4] dark:bg-stock-ok/10",
    wordColor: "text-stock-ok",
  },
  info: {
    word: "Mode",
    edge: "bg-steel-500",
    panel: "border-steel-300 bg-steel-50 dark:border-steel-700 dark:bg-steel-900",
    wordColor: "text-steel-600 dark:text-steel-300",
  },
  error: {
    word: "Blocked",
    edge: "bg-stock-none",
    panel: "border-stock-none/40 bg-[#fdf3f2] dark:bg-stock-none/10",
    wordColor: "text-stock-none",
  },
} as const;

// True when the demo is shown inside another page (the portfolio embeds it in
// a frame). There the scan box must not take focus by itself: that would pull
// the keyboard focus, and the scroll position, of the page around it.
function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export default function ScanPage() {
  const [outcomes, setOutcomes] = useState<ScanOutcome[]>([]);
  const [value, setValue] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [restockMode, setRestockMode] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  // Guard against the same code being sent twice while one is in flight.
  const busyCodes = useRef<Set<string>>(new Set());
  // Mirror mode state into refs so handleScan can stay a stable ([]) callback
  // (its identity is passed to the sample labels).
  const projectsRef = useRef<Project[]>([]);
  const activeProjectRef = useRef<Project | null>(null);
  const restockModeRef = useRef(false);
  // The reserved "General (Project Done)" project that normal scans log into.
  const generalIdRef = useRef<string | null>(null);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  useEffect(() => {
    activeProjectRef.current = activeProject;
  }, [activeProject]);
  useEffect(() => {
    restockModeRef.current = restockMode;
  }, [restockMode]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Ready for a handheld scanner as soon as the page opens — but not when the
  // demo is embedded in another page (see isEmbedded).
  useEffect(() => {
    if (!isEmbedded()) focusInput();
  }, [focusInput]);

  const refetchProjects = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("projects")
      .select("id, number, code, name, created_at, archived")
      .order("number", { ascending: false });
    const all = (data ?? []) as Project[];
    // The General/Done project is bound implicitly, never picked from the list.
    generalIdRef.current =
      all.find((p) => p.code === PROJECT_DONE_CODE)?.id ?? null;
    // Archived ("Done") projects are no longer scannable.
    setProjects(all.filter((p) => p.code !== PROJECT_DONE_CODE && !p.archived));
  }, []);

  // Load projects and keep them fresh so newly created projects are recognized
  // mid-session without a page refresh (mirrors the /stock realtime pattern).
  useEffect(() => {
    void refetchProjects();
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("scan-projects")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => {
          void refetchProjects();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchProjects]);

  const pushOutcome = useCallback((o: Omit<ScanOutcome, "id">) => {
    const id = nextId.current++;
    setOutcomes((prev) => [{ id, ...o }, ...prev].slice(0, 25));
  }, []);

  const handleScan = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || busyCodes.current.has(code)) return;

      // 1. DONE sentinel → return to normal (leaves project or restock mode).
      if (code === PROJECT_DONE_CODE) {
        const wasActive = activeProjectRef.current;
        const wasRestock = restockModeRef.current;
        setActiveProject(null);
        setRestockMode(false);
        pushOutcome({
          code,
          kind: "info",
          message: wasRestock
            ? "Exited restock mode."
            : wasActive
              ? `Exited project — ${wasActive.name}`
              : "Back to normal scanning.",
        });
        return;
      }

      // 2. RESTOCK sentinel → flip into add mode (each scan adds one unit).
      if (code === RESTOCK_MODE_CODE) {
        setActiveProject(null);
        setRestockMode(true);
        pushOutcome({
          code,
          kind: "info",
          message: "Restock mode on — every scan adds one to stock.",
          detail: "Scan the done barcode or a project barcode to stop.",
        });
        return;
      }

      // 3. Known project code → bind the scanner (no decrement, re-scan re-binds).
      const project = projectsRef.current.find((p) => p.code === code);
      if (project) {
        setRestockMode(false);
        setActiveProject(project);
        pushOutcome({
          code,
          kind: "info",
          message: `Scanning into Project ${project.number} — ${project.name}`,
          detail: "Every scan now logs to this project.",
        });
        return;
      }

      // 4. Bin scan → add (restock) or decrement (project / General-Done bucket).
      busyCodes.current.add(code);
      const supabase = getSupabaseBrowserClient();
      const active = activeProjectRef.current;
      const restock = restockModeRef.current;
      const generalId = generalIdRef.current;

      const { data, error } = restock
        ? await supabase.rpc("restock_part", { p_barcode: code })
        : active
          ? await supabase.rpc("use_part_in_project", {
              p_barcode: code,
              p_project_id: active.id,
            })
          : generalId
            ? await supabase.rpc("use_part_in_project", {
                p_barcode: code,
                p_project_id: generalId,
              })
            : await supabase.rpc("use_part", { p_barcode: code });

      if (error) {
        // A deleted active project surfaces as UNKNOWN_PROJECT — drop the mode.
        if (error.message.includes("UNKNOWN_PROJECT")) setActiveProject(null);
        pushOutcome({ code, kind: "error", message: describeError(error.message) });
      } else {
        const row = (Array.isArray(data) ? data[0] : data) as
          | UsePartResult
          | undefined;
        pushOutcome({
          code,
          kind: restock ? "added" : "used",
          message: row ? row.description : "Recorded.",
          quantity: row?.new_quantity,
          detail: row
            ? restock
              ? "now in this bin"
              : active
                ? `left in this bin · logged to ${active.name}`
                : "left in this bin"
            : undefined,
        });
      }
      busyCodes.current.delete(code);
    },
    [pushOutcome],
  );

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const code = value;
      setValue("");
      void handleScan(code);
      focusInput();
    },
    [value, handleScan, focusInput],
  );

  const latest = outcomes[0];

  return (
    // Demo layout: the real scan screen on the left, and a shelf of sample
    // labels to click on the right (between the scan box and the result on a
    // phone). The original page is the left column on its own.
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-x-10 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_1fr]">
      <div className="min-w-0">
      <div>
        <h1 className={pageTitle}>Scan out</h1>
        <p className="mt-1 text-[15px] text-steel-600 dark:text-steel-400">
          Every scan logs one unit used. Scan again for each additional unit.
        </p>
      </div>

      {/* What the next scan will do. Only one of these is ever on screen. */}
      {restockMode ? (
        <ModeBanner
          tone="alert"
          heading="Adding to stock"
          body="Every scan adds one unit. Scan the done barcode or a project barcode to stop."
          action="Exit restock"
          onExit={() => setRestockMode(false)}
        />
      ) : activeProject ? (
        <ModeBanner
          tone="steel"
          heading={`Project ${activeProject.number} — ${activeProject.name}`}
          body="Every scan is logged against this project. Scan the done barcode to stop."
          action="Exit project"
          onExit={() => setActiveProject(null)}
        />
      ) : (
        <p className="mt-5 border-l-2 border-steel-300 pl-3 text-sm text-steel-500 dark:border-steel-700 dark:text-steel-400">
          Normal scanning — parts go to the Done list. Scan a project or the
          restock barcode to switch.
        </p>
      )}

      <form onSubmit={submit} className="mt-5">
        <label
          htmlFor="scan-input"
          className="block text-[13px] font-semibold text-steel-700 dark:text-steel-300"
        >
          Scan or type a barcode
        </label>
        <input
          id="scan-input"
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(e) => {
            // Re-grab focus for uninterrupted HID scanning on desktop — but
            // only when focus went nowhere (a click on empty page). If it
            // moved to a button or link, leave it there so the page can be
            // used from the keyboard; and never pull focus back when the demo
            // is embedded in another page.
            if (isEmbedded() || e.relatedTarget) return;
            setTimeout(focusInput, 0);
          }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="e.g. HYD-2101"
          className="mt-1.5 w-full rounded-md border-2 border-steel-300 bg-white px-4 py-3.5 font-mono text-xl tracking-tight text-steel-900 outline-none transition-colors placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-steel-400 focus:border-brand dark:border-steel-700 dark:bg-steel-900 dark:text-steel-50"
        />
      </form>
      </div>

      <DemoLabels
        onScan={handleScan}
        className="mt-6 min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0"
      />

      <div className="min-w-0 lg:col-start-1 lg:row-start-2">

      {/* The result of the last scan — the one thing here meant to be read at
          arm's length, so it carries the weight: a colour edge for the verdict
          and the resulting count set large. */}
      <div aria-live="polite" aria-atomic="true">
        {latest && (
          <div
            className={`mt-6 flex overflow-hidden rounded-lg border ${RESULT[latest.kind].panel}`}
          >
            <div className={`w-1.5 shrink-0 ${RESULT[latest.kind].edge}`} />
            <div className="min-w-0 flex-1 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span
                  className={`text-[13px] font-bold ${RESULT[latest.kind].wordColor}`}
                >
                  {RESULT[latest.kind].word}
                </span>
                <span className="font-mono text-[13px] tracking-tight text-steel-500 dark:text-steel-400">
                  {latest.code}
                </span>
              </div>
              <p className="mt-1.5 text-lg font-semibold leading-snug text-steel-900 dark:text-steel-50">
                {latest.message}
              </p>
              {latest.quantity !== undefined ? (
                <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-5xl font-bold leading-none tracking-tight text-steel-900 dark:text-steel-50">
                    {latest.quantity}
                  </span>
                  <span className="text-sm text-steel-600 dark:text-steel-400">
                    {latest.detail}
                  </span>
                </p>
              ) : (
                latest.detail && (
                  <p className="mt-1 text-sm text-steel-600 dark:text-steel-400">
                    {latest.detail}
                  </p>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {outcomes.length > 1 && (
        <div className="mt-7">
          <h2 className={sectionTitle}>Earlier scans</h2>
          <ul className="mt-2 divide-y divide-steel-200 overflow-hidden rounded-lg border border-steel-200 bg-white dark:divide-steel-800 dark:border-steel-800 dark:bg-steel-900">
            {outcomes.slice(1).map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="shrink-0 font-mono text-[13px] tracking-tight text-steel-500 dark:text-steel-400">
                  {o.code}
                </span>
                <span
                  className={`min-w-0 truncate text-right ${
                    o.kind === "error"
                      ? "text-stock-none"
                      : o.kind === "added"
                        ? "text-brand-text dark:text-brand"
                        : "text-steel-700 dark:text-steel-300"
                  }`}
                >
                  {o.quantity !== undefined && (
                    <span className="mr-1.5 font-semibold text-steel-900 dark:text-steel-100">
                      {o.quantity}
                    </span>
                  )}
                  {o.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </div>
  );
}

// Tells the operator what the next scan will do, and gives them one way out.
function ModeBanner({
  tone,
  heading,
  body,
  action,
  onExit,
}: {
  tone: "alert" | "steel";
  heading: string;
  body: string;
  action: string;
  onExit: () => void;
}) {
  const alert = tone === "alert";
  return (
    <div
      className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 ${
        alert
          ? "border-brand/40 bg-brand-wash dark:bg-brand/10"
          : "border-steel-300 bg-white dark:border-steel-700 dark:bg-steel-900"
      }`}
    >
      <div className="min-w-0">
        <div className="text-base font-semibold text-steel-900 dark:text-steel-50">
          {heading}
        </div>
        <div className="mt-0.5 text-sm text-steel-600 dark:text-steel-400">
          {body}
        </div>
      </div>
      <button type="button" onClick={onExit} className={buttonSecondary}>
        {action}
      </button>
    </div>
  );
}
