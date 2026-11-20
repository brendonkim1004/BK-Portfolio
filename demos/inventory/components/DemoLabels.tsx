"use client";

import { useEffect, useRef, useState } from "react";
import { Barcode } from "@/components/Barcode";
import { binQuantity, db, subscribe } from "@/lib/demo/store";
import { PROJECT_DONE_CODE, RESTOCK_MODE_CODE } from "@/lib/types";

// Demo only: a shelf of sample barcode labels you can click.
//
// In the shop these labels are stuck to bins and read with a handheld scanner.
// Here, clicking one sends its code to the scan page's own handleScan — the
// same function the scanner input uses — so the real result panel answers.
// The label itself also shows what happened: a red line sweeps across the
// barcode, then the "in bin" number ticks to its new value (a green flash when
// stock moved, a red shake when the scan was refused).

// The bins on the shelf. The last two hold 1 and 0 at the start, so the
// "Blocked / out of stock" result is one or two clicks away.
const BIN_CODES = [
  "FST-1001",
  "HYD-2101",
  "FLT-5001",
  "SEL-4002",
  "HYD-2103",
  "HYD-2106",
];

// How long the scan line runs before the scan is sent (see .demo-sweep in
// globals.css). Skipped for people who ask for reduced motion.
const SWEEP_MS = 260;

type Props = {
  onScan: (code: string) => Promise<void> | void;
  className?: string;
};

export function DemoLabels({ onScan, className = "" }: Props) {
  // Bumped whenever the store changes, so the labels re-read live values.
  const [, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1);
    const stops = (["stock", "locations", "parts", "projects"] as const).map(
      (table) => subscribe(table, refresh),
    );
    return () => stops.forEach((stop) => stop());
  }, []);

  // The first project still open, to show one project barcode.
  const project = [...db.projects]
    .filter((p) => p.code !== PROJECT_DONE_CODE && !p.archived)
    .sort((a, b) => a.number - b.number)[0];

  return (
    <section
      aria-labelledby="demo-labels-title"
      className={`self-start rounded-lg border border-steel-200 bg-white p-4 lg:sticky lg:top-6 dark:border-steel-800 dark:bg-steel-900 ${className}`}
    >
      <h2
        id="demo-labels-title"
        className="text-sm font-bold text-steel-900 dark:text-steel-50"
      >
        Sample labels — click one to scan it
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-steel-500 dark:text-steel-400">
        These stand in for the stickers on the shelves. Each click is one scan.
      </p>

      {/* A sideways strip on a phone, a two-column sheet on a wide screen. */}
      <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-2 pt-1 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-1">
        {BIN_CODES.map((code) => (
          <BinLabel key={code} code={code} onScan={onScan} />
        ))}
        {project && (
          <ModeLabel
            code={project.code}
            title={`Project ${project.number}`}
            note={project.name}
            onScan={onScan}
          />
        )}
        <ModeLabel
          code={RESTOCK_MODE_CODE}
          title="Restock mode"
          note="Scans add one instead"
          onScan={onScan}
        />
        <ModeLabel
          code={PROJECT_DONE_CODE}
          title="Done"
          note="Back to normal scanning"
          onScan={onScan}
        />
      </div>
    </section>
  );
}

// --- One label --------------------------------------------------------------

type Verdict = "ok" | "blocked" | "mode";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The click behaviour and animations every label shares.
function useLabelScan(
  code: string,
  onScan: Props["onScan"],
  // Reads the number that should change, or null for a label with no number.
  readQuantity: () => number | null,
) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [sweep, setSweep] = useState(0); // counts scans, restarts the red line
  const [flash, setFlash] = useState<{ id: number; verdict: Verdict } | null>(null);

  // Restart a CSS animation on the button itself (pulse or shake).
  const play = (name: string) => {
    const el = buttonRef.current;
    if (!el) return;
    el.classList.remove("demo-pulse", "demo-shake");
    void el.offsetWidth; // forces the browser to notice the class was removed
    el.classList.add(name);
  };

  const scan = async () => {
    setSweep((n) => n + 1);
    if (!prefersReducedMotion()) {
      await new Promise((resolve) => setTimeout(resolve, SWEEP_MS));
    }
    const before = readQuantity();
    await onScan(code);
    const after = readQuantity();

    const verdict: Verdict =
      before === null && after === null
        ? "mode"
        : after !== before
          ? "ok"
          : "blocked";
    setFlash((f) => ({ id: (f?.id ?? 0) + 1, verdict }));
    play(verdict === "blocked" ? "demo-shake" : "demo-pulse");
  };

  // The red scan line, drawn over the barcode only.
  const scanLine = sweep > 0 && (
    <span
      key={`sweep-${sweep}`}
      aria-hidden
      className="demo-sweep pointer-events-none absolute inset-0"
    >
      <span className="absolute inset-y-0 left-0 w-0.5 bg-brand" />
    </span>
  );

  // The colour flash, drawn over the whole label.
  const overlays = (
    <>
      {flash && (
        <span
          key={`flash-${flash.id}`}
          aria-hidden
          className={`demo-flash pointer-events-none absolute inset-0 rounded-md border-2 ${
            flash.verdict === "blocked"
              ? "border-stock-none bg-stock-none/10"
              : flash.verdict === "ok"
                ? "border-stock-ok bg-stock-ok/10"
                : "border-steel-500 bg-steel-500/10"
          }`}
        />
      )}
    </>
  );

  return { buttonRef, scan, scanLine, overlays };
}

// Printed-sticker look: always white with dark type, like the real labels.
const labelClass =
  "relative w-44 shrink-0 overflow-hidden rounded-md border border-steel-300 bg-white p-2 text-left text-steel-900 hover:border-steel-500 lg:w-auto";

const barcodeBox = "relative flex justify-center overflow-hidden [&>svg]:h-auto";

function BinLabel({ code, onScan }: { code: string; onScan: Props["onScan"] }) {
  const { buttonRef, scan, scanLine, overlays } = useLabelScan(code, onScan, () =>
    binQuantity(code),
  );

  const quantity = binQuantity(code);
  const loc = db.locations.find((l) => l.barcode_code === code);
  const part = loc ? db.parts.find((p) => p.id === loc.part_id) : undefined;
  const description = part?.description ?? "No part in this bin";

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={scan}
      aria-label={`Scan ${code}, ${description}, ${quantity ?? 0} in bin`}
      className={labelClass}
    >
      <span className={barcodeBox}>
        <Barcode value={code} width={1.2} height={34} />
        {scanLine}
      </span>
      <span className="mt-1 block truncate text-xs font-semibold">
        {description}
      </span>
      <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-steel-500">
        <span>In bin</span>
        {/* Keyed by the number, so a new value drops in with a small tick. */}
        <span
          key={quantity ?? "none"}
          className={`demo-tick font-mono text-base font-bold ${
            quantity === 0 ? "text-stock-none" : "text-steel-900"
          }`}
        >
          {quantity ?? "—"}
        </span>
      </span>
      {overlays}
    </button>
  );
}

function ModeLabel({
  code,
  title,
  note,
  onScan,
}: {
  code: string;
  title: string;
  note: string;
  onScan: Props["onScan"];
}) {
  const { buttonRef, scan, scanLine, overlays } = useLabelScan(code, onScan, () => null);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={scan}
      aria-label={`Scan ${code}: ${title}, ${note}`}
      className={labelClass}
    >
      <span className={barcodeBox}>
        <Barcode value={code} width={1.2} height={34} />
        {scanLine}
      </span>
      <span className="mt-1 block truncate text-xs font-semibold">{title}</span>
      <span className="mt-0.5 block truncate text-xs text-steel-500">{note}</span>
      {overlays}
    </button>
  );
}
