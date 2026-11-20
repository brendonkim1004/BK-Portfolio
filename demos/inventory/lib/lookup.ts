"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Server-side catalog lookups.
//
// These replace lib/catalog.ts, which downloaded every part and every bin so
// the browser could filter them in memory. At ~6,800 parts and ~6,800 bins that
// is fourteen round-trips of 1,000 rows before the admin page can render, and
// it grows with the catalog. Postgres already indexes what we need, so the
// search belongs there: each helper asks for at most `limit` matching rows.
//
// PostgREST filter strings are comma/parenthesis delimited and use * as the
// ilike wildcard, so those characters can't be passed through from a search box
// verbatim. Same sanitiser as /stock uses.
export function sanitize(q: string): string {
  return q.replace(/[,()*\\%]/g, " ").trim();
}

export type PartOption = {
  id: string;
  sku: number;
  description: string;
};

export type BinOption = {
  id: string;
  barcode_code: string;
  part_id: string | null;
  description: string | null;
};

const DEFAULT_LIMIT = 20;

// Parts matching a description or SKU fragment. An all-digits query also
// matches the SKU exactly, so "SKU 412" is findable by typing 412.
export async function searchParts(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<PartOption[]> {
  const term = sanitize(query);
  let q = getSupabaseBrowserClient()
    .from("parts")
    .select("id, sku, description")
    .order("sku", { ascending: true })
    .limit(limit);

  if (term) {
    q = /^\d+$/.test(term)
      ? q.or(`description.ilike.*${term}*,sku.eq.${term}`)
      : q.ilike("description", `*${term}*`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PartOption[];
}

// Bins matching a barcode or the description of the part they hold.
//
// `assigned` filters to bins that do ("yes") or don't ("no") currently hold a
// part. The quantity forms only make sense against a bin with a part in it;
// the attach picker only offers empty ones.
export async function searchBins(
  query: string,
  opts: { assigned?: "yes" | "no"; limit?: number } = {},
): Promise<BinOption[]> {
  const { assigned, limit = DEFAULT_LIMIT } = opts;
  const term = sanitize(query);
  const supabase = getSupabaseBrowserClient();

  const base = (embed: string) => {
    let q = supabase
      .from("locations")
      .select(`id, barcode_code, part_id, ${embed}`)
      .order("barcode_code", { ascending: true })
      .limit(limit);
    if (assigned === "yes") q = q.not("part_id", "is", null);
    if (assigned === "no") q = q.is("part_id", null);
    return q;
  };

  if (!term) {
    const { data, error } = await base("parts(description)");
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as RawBin[]).map(toBinOption);
  }

  // A bin matches on its own barcode, or on the description of the part it
  // holds. Those can't be one query: filtering an embedded resource forces an
  // inner join, which would drop every empty bin from the barcode half. So run
  // both and merge. The description half is skipped when we only want empty
  // bins, since an empty bin has no description to match.
  const byBarcode = base("parts(description)").ilike("barcode_code", `*${term}*`);
  const byDescription =
    assigned === "no"
      ? null
      : base("parts!inner(description)").ilike("parts.description", `*${term}*`);

  const [barcodeRes, descRes] = await Promise.all([
    byBarcode,
    byDescription ?? Promise.resolve({ data: [], error: null }),
  ]);
  if (barcodeRes.error) throw new Error(barcodeRes.error.message);
  if (descRes.error) throw new Error(descRes.error.message);

  const merged = new Map<string, BinOption>();
  for (const raw of [
    ...((barcodeRes.data ?? []) as unknown as RawBin[]),
    ...((descRes.data ?? []) as unknown as RawBin[]),
  ]) {
    if (!merged.has(raw.id)) merged.set(raw.id, toBinOption(raw));
  }
  return [...merged.values()]
    .sort((a, b) => a.barcode_code.localeCompare(b.barcode_code))
    .slice(0, limit);
}

type RawBin = {
  id: string;
  barcode_code: string;
  part_id: string | null;
  // PostgREST returns a single object for this many-to-one embed, though the
  // generated client types it more loosely.
  parts: { description: string } | null;
};

function toBinOption(b: RawBin): BinOption {
  return {
    id: b.id,
    barcode_code: b.barcode_code,
    part_id: b.part_id,
    description: b.parts?.description ?? null,
  };
}

// The bins currently holding a part, with the quantity in each.
export async function loadPartBins(
  partId: string,
): Promise<{ locationId: string; barcode: string; quantity: number }[]> {
  const supabase = getSupabaseBrowserClient();
  const [{ data: locs, error: lErr }, { data: stock, error: sErr }] =
    await Promise.all([
      supabase
        .from("locations")
        .select("id, barcode_code")
        .eq("part_id", partId)
        .order("barcode_code"),
      supabase
        .from("stock")
        .select("location_id, quantity")
        .eq("part_id", partId),
    ]);
  if (lErr || sErr) throw new Error((lErr ?? sErr)!.message);

  const qtyByLoc = new Map(
    (stock ?? []).map((s) => [s.location_id as string, s.quantity as number]),
  );
  return (locs ?? []).map((l) => ({
    locationId: l.id as string,
    barcode: l.barcode_code as string,
    quantity: qtyByLoc.get(l.id as string) ?? 0,
  }));
}
