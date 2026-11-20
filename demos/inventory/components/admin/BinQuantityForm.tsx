"use client";

import { useCallback, useState } from "react";
import { adminPost } from "@/lib/adminApi";
import { SearchSelect, type SearchOption } from "@/components/SearchSelect";
import { searchBins } from "@/lib/lookup";
import { NO_PROJECT, ProjectSelect } from "./ProjectSelect";
import { button, card, input, label } from "./formStyles";

type Mode = "restock" | "correct" | "subtract";

type Props = {
  mode: Mode;
  onDone: () => void;
};

const COPY: Record<
  Mode,
  {
    title: string;
    blurb: string;
    path: string;
    qtyLabel: string;
    cta: string;
    // Present on the two modes a project can apply to. Subtract books a
    // quantity to a job; restock takes one back off it.
    project?: { label: string; hint: string };
  }
> = {
  restock: {
    title: "Add stock (restock)",
    blurb: "Adds the received quantity to what's already in the bin. Logged.",
    path: "/api/admin/restock",
    qtyLabel: "Quantity received",
    cta: "Add stock",
    project: {
      label: "Take back from project",
      hint: "Fixing a double scan? This quantity also comes off that project’s usage.",
    },
  },
  subtract: {
    title: "Remove stock (subtract)",
    blurb: "Removes the given quantity from the bin (won't go below 0). Logged.",
    path: "/api/admin/subtract",
    qtyLabel: "Quantity to remove",
    cta: "Remove stock",
    project: {
      label: "Book to project",
      hint: "Choosing a project records this the same way scanning the bin that many times would.",
    },
  },
  correct: {
    title: "Correct count (override)",
    blurb: "Sets the bin's quantity to an exact value. Silent, not logged.",
    path: "/api/admin/correct",
    qtyLabel: "Correct quantity",
    cta: "Set quantity",
  },
};

export function BinQuantityForm({ mode, onDone }: Props) {
  const copy = COPY[mode];

  // Only bins that hold a part: there is no quantity to move in an empty one.
  const search = useCallback(async (q: string): Promise<SearchOption[]> => {
    const bins = await searchBins(q, { assigned: "yes" });
    return bins.map((b) => ({
      id: b.id,
      label: `${b.barcode_code} · ${b.description ?? ""}`,
    }));
  }, []);

  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  // Both stock-moving forms can involve a project: subtract books a quantity
  // to one, restock takes it back off. A correction states what the shelf
  // holds and is nobody’s consumption, so it has no project at all.
  const [projectId, setProjectId] = useState(NO_PROJECT);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!locationId) {
      setMsg({ ok: false, text: "Choose a bin." });
      return;
    }
    setBusy(true);
    try {
      const asked = Number(qty);
      const withProject = copy.project && projectId !== NO_PROJECT;
      const { quantity, unbooked } = await adminPost<{
        quantity: number;
        unbooked?: number;
      }>(copy.path, {
        location_id: locationId,
        quantity: asked,
        ...(withProject ? { project_id: projectId } : {}),
      });

      // The add-back reports both halves, because they can differ: the project
      // side stops at what the job actually had recorded, and saying so is the
      // difference between a correction someone can trust and a silent one.
      let text = `Done. Bin now holds ${quantity}.`;
      if (mode === "restock" && withProject) {
        if (unbooked === asked) {
          text += ` Removed ${unbooked} from the project.`;
        } else if (unbooked === 0) {
          text += " The project had none of this part recorded, so nothing came off it.";
        } else {
          text += ` Removed ${unbooked} from the project — that is all it had recorded.`;
        }
      }
      setMsg({ ok: true, text });
      setQty("");
      // The project deliberately survives a submit: booking several different
      // parts out to the same job is the reason this exists, and re-picking it
      // every time is where a misattribution would come from.
      onDone();
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={card}>
      <h3 className="font-semibold">{copy.title}</h3>
      <p className="mt-1 text-sm text-steel-600 dark:text-steel-400">
        {copy.blurb}
      </p>

      <div className="mt-4">
        <label className={label} htmlFor={`${mode}-bin`}>
          Bin
        </label>
        <SearchSelect
          id={`${mode}-bin`}
          search={search}
          value={locationId}
          selectedLabel={locationLabel}
          onChange={(id, option) => {
            setLocationId(id);
            setLocationLabel(option?.label ?? null);
          }}
          placeholder="Search a bin by item no. or name…"
        />
      </div>

      <div className="mt-4">
        <label className={label} htmlFor={`${mode}-qty`}>
          {copy.qtyLabel}
        </label>
        <input
          id={`${mode}-qty`}
          className={input}
          type="number"
          min={mode === "correct" ? 0 : 1}
          step={1}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={mode === "correct" ? "0" : "5"}
        />
      </div>

      {copy.project && (
        <div className="mt-4">
          <label className={label} htmlFor={`${mode}-project`}>
            {copy.project.label}
          </label>
          <ProjectSelect
            id={`${mode}-project`}
            className={input}
            value={projectId}
            onChange={setProjectId}
            disabled={busy}
          />
          <p className="mt-1 text-sm text-steel-500 dark:text-steel-400">
            {copy.project.hint}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button className={button} disabled={busy}>
          {busy ? "Saving…" : copy.cta}
        </button>
        {msg && (
          <span
            className={`text-sm ${
              msg.ok
                ? "text-stock-ok"
                : "text-stock-none"
            }`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
