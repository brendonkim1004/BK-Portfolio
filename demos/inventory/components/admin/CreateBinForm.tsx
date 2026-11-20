"use client";

import { useCallback, useState } from "react";
import { adminPost } from "@/lib/adminApi";
import { SearchSelect, type SearchOption } from "@/components/SearchSelect";
import { searchParts } from "@/lib/lookup";
import type { Location } from "@/lib/types";
import { button, card, input, label } from "./formStyles";

export function CreateBinForm({ onDone }: { onDone: () => void }) {
  const [barcode, setBarcode] = useState("");
  const [partId, setPartId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [partLabel, setPartLabel] = useState<string | null>(null);

  const search = useCallback(async (q: string): Promise<SearchOption[]> => {
    const found = await searchParts(q);
    return found.map((p) => ({
      id: p.id,
      label: `SKU ${p.sku} — ${p.description}`,
    }));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const { location } = await adminPost<{ location: Location }>(
        "/api/admin/locations",
        { barcode_code: barcode, part_id: partId },
      );
      setMsg({ ok: true, text: `Created bin ${location.barcode_code}.` });
      setBarcode("");
      setPartId(null);
      setPartLabel(null);
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
      <h3 className="font-semibold">Create bin</h3>
      <p className="mt-1 text-sm text-steel-600 dark:text-steel-400">
        Register a bin barcode and optionally assign the part it holds.
      </p>
      <div className="mt-4">
        <label className={label} htmlFor="bin-code">
          Barcode
        </label>
        <input
          id="bin-code"
          className={input}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="e.g. BIN-A08"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
      <div className="mt-4">
        <label className={label} htmlFor="bin-part">
          Part (optional)
        </label>
        <SearchSelect
          id="bin-part"
          search={search}
          value={partId}
          selectedLabel={partLabel}
          onChange={(id, option) => {
            setPartId(id);
            setPartLabel(option?.label ?? null);
          }}
          placeholder="Leave empty, or search a part…"
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className={button} disabled={busy || !barcode.trim()}>
          {busy ? "Saving…" : "Create bin"}
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
