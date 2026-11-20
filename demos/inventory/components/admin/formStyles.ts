// Shared Tailwind class strings, kept in one place so every surface in the app
// speaks the same visual language. See app/globals.css for the tokens behind
// the colour names.

// Panels sit on the steel ground with a hairline edge and a single soft shadow.
// Square-ish corners (not pill-round) — this is equipment, not a marketing site.
export const card =
  "rounded-lg border border-steel-200 bg-white p-5 shadow-[0_1px_2px_rgba(28,30,27,0.06)] dark:border-steel-800 dark:bg-steel-900";

export const label =
  "block text-[13px] font-semibold text-steel-700 dark:text-steel-300";

export const input =
  "mt-1.5 w-full rounded-md border border-steel-300 bg-white px-3 py-2 text-[15px] text-steel-900 placeholder:text-steel-400 outline-none transition-colors focus:border-steel-500 dark:border-steel-700 dark:bg-steel-950 dark:text-steel-100";

// Item numbers are codes: mono, tight tracking, so they can be compared
// character by character against a printed label.
export const inputMono = `${input} font-mono tracking-tight`;

// The one Concord-red control on a form or panel: the thing you are meant to
// press. White label, so it uses the AA-safe fill rather than the raw brand red.
export const button =
  "inline-flex items-center justify-center rounded-md bg-brand-fill px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40";

export const buttonSecondary =
  "inline-flex items-center justify-center rounded-md border border-steel-300 bg-white px-4 py-2 text-sm font-semibold text-steel-800 transition-colors hover:bg-steel-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-steel-700 dark:bg-steel-900 dark:text-steel-200 dark:hover:bg-steel-800";

// Compact variant for controls that sit inside a table row.
export const buttonSmall =
  "inline-flex items-center justify-center rounded border border-steel-300 bg-white px-2 py-1 text-[13px] font-semibold text-steel-800 transition-colors hover:bg-steel-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-steel-700 dark:bg-steel-900 dark:text-steel-200 dark:hover:bg-steel-800";

export const buttonDanger =
  "inline-flex items-center justify-center rounded-md border border-stock-none/40 bg-white px-3 py-1.5 text-sm font-semibold text-stock-none transition-colors hover:bg-stock-none hover:text-white dark:bg-transparent";

// Column headings: small, heavy, and steel — the data is what should be read,
// not the labels above it.
export const tableHead =
  "border-b border-steel-200 bg-steel-50 text-[12px] font-bold text-steel-600 dark:border-steel-800 dark:bg-steel-900 dark:text-steel-400";

export const sectionTitle =
  "text-[13px] font-bold text-steel-500 dark:text-steel-400";

export const pageTitle =
  "text-2xl font-bold tracking-tight text-steel-900 dark:text-steel-50";

export const muted = "text-steel-500 dark:text-steel-400";

// Compact danger variant, for the destructive control inside a table row.
export const buttonDangerSmall =
  "inline-flex items-center justify-center rounded border border-stock-none/40 bg-white px-2 py-1 text-[13px] font-semibold text-stock-none transition-colors hover:bg-stock-none hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-transparent";
