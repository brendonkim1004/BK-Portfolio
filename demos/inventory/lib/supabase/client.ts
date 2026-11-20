"use client";

// A stand-in for the Supabase browser client.
//
// The real app's pages call supabase.from(...).select(...), supabase.rpc(...)
// and supabase.channel(...). This file answers those same calls from the
// in-memory tables in lib/demo/store.ts, so the pages run unchanged with no
// backend, no keys and no network. It only covers what the pages actually use.

import { db, partStockList, subscribe } from "@/lib/demo/store";
import type { Row, TableName } from "@/lib/demo/store";
import {
  DemoDbError,
  createProject,
  restockPart,
  setProjectArchived,
  setProjectUsage,
  usePart,
  usePartInProject,
} from "@/lib/demo/rpc";

// What every query and rpc call resolves to, like Supabase: rows (or one row
// after single()/maybeSingle()), an error or null, and a count when asked.
// `data` is typed loosely on purpose: the pages were written against
// Supabase's own types and cast the rows themselves.
type Result = {
  data: any[] | null;
  error: { message: string; code?: string } | null;
  count: number | null;
};

// --- Tables and how they join ---------------------------------------------

function tableRows(table: string): Row[] {
  if (table === "part_stock_list") return partStockList();
  return (db as Record<string, Row[]>)[table] ?? [];
}

// "one": the row points at a single row of the other table (bin -> its part).
// "many": rows of the other table point back at this one (part -> its bins).
type Relation = { kind: "one" | "many"; table: TableName; key: string };

const RELATIONS: Record<string, Relation> = {
  "locations.parts": { kind: "one", table: "parts", key: "part_id" },
  "project_usage.parts": { kind: "one", table: "parts", key: "part_id" },
  "project_usage.projects": { kind: "one", table: "projects", key: "project_id" },
  "scan_log.parts": { kind: "one", table: "parts", key: "part_id" },
  "scan_log.projects": { kind: "one", table: "projects", key: "project_id" },
  "parts.locations": { kind: "many", table: "locations", key: "part_id" },
};

// Follow a relation from one row: an object (or null) for "one", a list for
// "many". Bins come back in barcode order so the first is the item number.
function related(table: string, row: Row, name: string): Row | Row[] | null {
  const rel = RELATIONS[`${table}.${name}`];
  if (!rel) return null;
  if (rel.kind === "one") {
    return db[rel.table].find((r) => r.id === row[rel.key]) ?? null;
  }
  return db[rel.table]
    .filter((r) => r[rel.key] === row.id)
    .sort((a, b) => String(a.barcode_code).localeCompare(String(b.barcode_code)));
}

// --- Reading a select string ----------------------------------------------

// "id, name, parts(description, locations(barcode_code))" becomes a small
// tree: plain columns, plus embedded tables with their own columns.
type Shape = {
  columns: string[]; // ["*"] means every column
  embeds: { name: string; inner: boolean; shape: Shape }[];
};

function parseSelect(text: string): Shape {
  const shape: Shape = { columns: [], embeds: [] };
  // Split on commas that are not inside brackets.
  const pieces: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      pieces.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  pieces.push(current);

  for (const raw of pieces) {
    const piece = raw.trim();
    if (!piece) continue;
    const open = piece.indexOf("(");
    if (open === -1) {
      shape.columns.push(piece);
      continue;
    }
    // "parts!inner(description)": !inner drops rows with no matching part.
    const [name, hint] = piece.slice(0, open).split("!");
    shape.embeds.push({
      name: name.trim(),
      inner: hint === "inner",
      shape: parseSelect(piece.slice(open + 1, piece.lastIndexOf(")"))),
    });
  }
  return shape;
}

// Build the object a query returns for one row.
function project(table: string, row: Row, shape: Shape): Row {
  const out: Row = {};
  if (shape.columns.includes("*")) Object.assign(out, row);
  else for (const col of shape.columns) out[col] = row[col] ?? null;

  for (const embed of shape.embeds) {
    const rel = RELATIONS[`${table}.${embed.name}`];
    const target = related(table, row, embed.name);
    if (!rel || target === null) out[embed.name] = null;
    else if (Array.isArray(target)) {
      out[embed.name] = target.map((r) => project(rel.table, r, embed.shape));
    } else {
      out[embed.name] = project(rel.table, target, embed.shape);
    }
  }
  return out;
}

// --- Filters --------------------------------------------------------------

// A column's value; "parts.description" reads through to the joined part.
function valueOf(table: string, row: Row, column: string): unknown {
  const dot = column.indexOf(".");
  if (dot === -1) return row[column];
  const target = related(table, row, column.slice(0, dot));
  if (!target || Array.isArray(target)) return undefined;
  return target[column.slice(dot + 1)];
}

// ilike: case-insensitive match where * (or %) stands for "anything".
function likeMatch(value: unknown, pattern: string): boolean {
  if (value === null || value === undefined) return false;
  const source = pattern
    .split(/[*%]/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}$`, "i").test(String(value));
}

function isNull(value: unknown): boolean {
  return value === null || value === undefined;
}

// One test: column, operator, value. Comparing with a missing value is never
// true, the same as in SQL.
function test(value: unknown, op: string, wanted: unknown): boolean {
  switch (op) {
    case "eq":
      return !isNull(value) && String(value) === String(wanted);
    case "neq":
      return !isNull(value) && String(value) !== String(wanted);
    case "ilike":
      return likeMatch(value, String(wanted));
    case "is":
      return isNull(wanted) || wanted === "null" ? isNull(value) : value === wanted;
    case "in":
      return (wanted as unknown[]).some((w) => String(w) === String(value));
    default:
      return true;
  }
}

type Filter = (table: string, row: Row) => boolean;

// --- The query builder ----------------------------------------------------

class Query {
  private table: string;
  private shape: Shape = { columns: ["*"], embeds: [] };
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean; nullsFirst: boolean }[] = [];
  private from: number | null = null;
  private to: number | null = null;
  private max: number | null = null;
  private wantCount = false;
  private one: "single" | "maybeSingle" | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*", options?: { count?: string }) {
    this.shape = parseSelect(columns);
    this.wantCount = options?.count === "exact";
    return this;
  }

  private where(column: string, op: string, wanted: unknown, negate = false) {
    this.filters.push((table, row) => {
      const hit = test(valueOf(table, row, column), op, wanted);
      return negate ? !hit : hit;
    });
    return this;
  }

  eq(column: string, value: unknown) {
    return this.where(column, "eq", value);
  }
  neq(column: string, value: unknown) {
    return this.where(column, "neq", value);
  }
  in(column: string, values: unknown[]) {
    return this.where(column, "in", values);
  }
  is(column: string, value: unknown) {
    return this.where(column, "is", value);
  }
  not(column: string, op: string, value: unknown) {
    return this.where(column, op, value, true);
  }
  ilike(column: string, pattern: string) {
    return this.where(column, "ilike", pattern);
  }

  // "item_no.ilike.*hose*,description.ilike.*hose*": any one may match.
  or(text: string) {
    const tests = text.split(",").map((piece) => {
      const first = piece.indexOf(".");
      const second = piece.indexOf(".", first + 1);
      return {
        column: piece.slice(0, first),
        op: piece.slice(first + 1, second),
        wanted: piece.slice(second + 1),
      };
    });
    this.filters.push((table, row) =>
      tests.some((t) => test(valueOf(table, row, t.column), t.op, t.wanted)),
    );
    return this;
  }

  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    const ascending = options.ascending ?? true;
    // Postgres puts missing values last going up and first going down, unless told.
    this.orders.push({ column, ascending, nullsFirst: options.nullsFirst ?? !ascending });
    return this;
  }

  range(from: number, to: number) {
    this.from = from;
    this.to = to;
    return this;
  }

  limit(count: number) {
    this.max = count;
    return this;
  }

  single() {
    this.one = "single";
    return this;
  }

  maybeSingle() {
    this.one = "maybeSingle";
    return this;
  }

  private run(): Result {
    let rows = tableRows(this.table).filter((row) =>
      this.filters.every((f) => f(this.table, row)),
    );

    // An !inner embed keeps only rows that have the related row.
    for (const embed of this.shape.embeds) {
      if (embed.inner) rows = rows.filter((row) => related(this.table, row, embed.name));
    }

    if (this.orders.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const o of this.orders) {
          const x = a[o.column];
          const y = b[o.column];
          if (isNull(x) && isNull(y)) continue;
          if (isNull(x)) return o.nullsFirst ? -1 : 1;
          if (isNull(y)) return o.nullsFirst ? 1 : -1;
          const cmp =
            typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x).localeCompare(String(y));
          if (cmp !== 0) return o.ascending ? cmp : -cmp;
        }
        return 0;
      });
    }

    const count = this.wantCount ? rows.length : null;
    if (this.from !== null && this.to !== null) rows = rows.slice(this.from, this.to + 1);
    if (this.max !== null) rows = rows.slice(0, this.max);

    const data = rows.map((row) => project(this.table, row, this.shape));

    if (this.one) {
      if (data.length > 1 || (this.one === "single" && data.length === 0)) {
        return { data: null, error: { message: "Expected exactly one row." }, count };
      }
      // One row rather than a list (the loose `data` type covers both).
      return { data: (data[0] ?? null) as any, error: null, count };
    }
    return { data, error: null, count };
  }

  // Makes the query awaitable: `const { data, error } = await query`.
  then<A = Result, B = never>(
    resolve?: ((result: Result) => A | PromiseLike<A>) | null,
    reject?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(resolve, reject);
  }
}

// --- rpc() ----------------------------------------------------------------

function callFunction(name: string, args: Row): unknown {
  switch (name) {
    case "use_part":
      return usePart(args.p_barcode);
    case "use_part_in_project":
      return usePartInProject(args.p_barcode, args.p_project_id);
    case "restock_part":
      return restockPart(args.p_barcode);
    case "create_project":
      return createProject(args.p_name);
    case "set_project_usage":
      return setProjectUsage(args.p_project_id, args.p_part_id, args.p_quantity);
    case "set_project_archived":
      return setProjectArchived(args.p_project_id, args.p_archived);
    default:
      throw new DemoDbError(`Unknown function ${name}`);
  }
}

async function rpc(name: string, args: Row = {}): Promise<Result> {
  try {
    return { data: callFunction(name, args) as any, error: null, count: null };
  } catch (err) {
    // The pages look for the error word (OUT_OF_STOCK...) in `message`.
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return { data: null, error: { message, code: "P0001" }, count: null };
  }
}

// --- channel(): live updates ----------------------------------------------

// Same chain as Supabase realtime: channel(name).on(...).on(...).subscribe().
// Each .on() names a table; the callback runs whenever that table changes.
class Channel {
  private wanted: { table: TableName; callback: () => void }[] = [];
  private stops: (() => void)[] = [];

  on(_event: string, filter: { table: string; [key: string]: unknown }, callback: (payload?: any) => void) {
    this.wanted.push({ table: filter.table as TableName, callback: () => callback({}) });
    return this;
  }

  subscribe() {
    this.stops = this.wanted.map((w) => subscribe(w.table, w.callback));
    return this;
  }

  unsubscribe() {
    for (const stop of this.stops) stop();
    this.stops = [];
  }
}

// --- The client -----------------------------------------------------------

const client = {
  from: (table: string) => new Query(table),
  rpc,
  channel: (_name: string) => new Channel(),
  removeChannel: (channel: Channel) => channel.unsubscribe(),
};

export function getSupabaseBrowserClient() {
  return client;
}
