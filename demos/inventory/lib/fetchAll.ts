import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// PostgREST returns at most 1000 rows per request. This pages through a table
// with a stable sort so the full catalog (thousands of parts/bins) loads
// completely. `order` is required to keep page boundaries consistent.
export async function fetchAllRows<T>(
  table: string,
  columns: string,
  order: { column: string; ascending?: boolean },
): Promise<T[]> {
  const supabase = getSupabaseBrowserClient();
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order.column, { ascending: order.ascending ?? true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}
