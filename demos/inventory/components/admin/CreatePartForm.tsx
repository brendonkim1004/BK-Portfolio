"use client";

import { useState } from "react";
import { adminPost } from "@/lib/adminApi";
import type { Location, Part } from "@/lib/types";
import { button, card, input, inputMono, label } from "./formStyles";

// Adds a part to the catalog, with its item number in the same step.
//
// The item number is the barcode that goes on the part's bin — it is what gets
// scanned, searched and printed, so a part created without one is a record
// nobody can reach. It stays optional for the case where the bin genuinely
// isn't decided yet, but the form leads with it.
export function CreatePartForm({ onDone }: { onDone: () => void }) {
  const [description, setDescription] = useState("");
  const [itemNo, setItemNo] = useState("");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const { part, location, quantity: opening } = await adminPost<{
        part: Part;
        location?: Location;
        quantity?: number;
      }>("/api/admin/parts", {
        description,
        item_no: itemNo,
        quantity,
      });
      setMsg({
        ok: true,
        text: location
          ? `Added ${location.barcode_code} — ${part.description}, starting at ${opening ?? 0}.`
          : `Added ${part.description}. Give it an item number to make it scannable.`,
      });
      setDescription("");
      setItemNo("");
      setQuantity("");
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
      <h3 className="font-bold text-steel-900 dark:text-steel-50">Add a part</h3>
      <p className="mt-1 text-sm text-steel-600 dark:text-steel-400">
        Creates the part, its bin, and its opening count.
      </p>

      <div className="mt-4">
        <label className={label} htmlFor="part-item-no">
          Item number
        </label>
        <input
          id="part-item-no"
          className={inputMono}
          value={itemNo}
          onChange={(e) => setItemNo(e.target.value)}
          placeholder="e.g. 000130065"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="mt-1 text-xs text-steel-500 dark:text-steel-400">
          Goes on the bin barcode. Leave empty to add the part without a bin.
        </p>
      </div>

      <div className="mt-4">
        <label className={label} htmlFor="part-description">
          Description
        </label>
        <input
          id="part-description"
          className={input}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Boss For Pipe Connection"
        />
      </div>

      <div className="mt-4">
        <label className={label} htmlFor="part-quantity">
          Starting quantity
        </label>
        <input
          id="part-quantity"
          className={input}
          type="number"
          min={0}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0"
        />
        <p className="mt-1 text-xs text-steel-500 dark:text-steel-400">
          What is on the shelf now. Leave empty for zero. Recorded as an opening
          count, so it is not logged as a restock.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={button} disabled={busy || !description.trim()}>
          {busy ? "Adding…" : "Add part"}
        </button>
        {msg && (
          <span
            className={`text-sm ${
              msg.ok ? "text-stock-ok" : "text-stock-none"
            }`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
