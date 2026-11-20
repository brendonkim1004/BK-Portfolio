// Shared domain types mirroring the Supabase schema (supabase/migrations/0001_init.sql).

export type Part = {
  id: string;
  sku: number;
  description: string;
  created_at: string;
};

export type Location = {
  id: string;
  barcode_code: string;
  part_id: string | null;
  created_at: string;
};

export type Stock = {
  id: string;
  part_id: string;
  location_id: string;
  quantity: number;
};

export type StockTransactionType = "used" | "restock";

// Row returned by the part_stock_totals view (office live table).
// `counted` is false for parts the Final Inventory Count never listed — their
// total_quantity is meaningless, so /stock shows "N/A" instead of a number.
export type PartStockTotal = {
  part_id: string;
  sku: number;
  description: string;
  counted: boolean;
  total_quantity: number;
};

// Result of the use_part() RPC on a successful scan.
export type UsePartResult = {
  part_id: string;
  sku: number;
  description: string;
  location_id: string;
  new_quantity: number;
};

// A bin with its assigned part joined in (admin restock/correction pickers).
export type LocationWithPart = Location & {
  parts: Pick<Part, "id" | "sku" | "description"> | null;
};

// Reserved barcode that exits project mode on the scan page. It must never be
// used as a bin barcode, and it is what the printed "DONE" label encodes. It is
// also the `code` of the reserved "General (Project Done)" project that normal
// scan-outs are logged into.
export const PROJECT_DONE_CODE = "PROJECT-DONE";

// Reserved barcode that flips the scanner into restock (ADD) mode. Also never a
// bin barcode.
export const RESTOCK_MODE_CODE = "RESTOCK-MODE";

// The scanner-test item's bin barcode. Unlike the two codes above this IS a real
// bin barcode (see supabase/migrations/0007_test_item.sql) — scanning it moves
// real stock on a throwaway part. /stock pins this item to the top of the list.
export const TEST_ITEM_CODE = "TEST-ITEM";

// A project/job. `code` is its scannable Code128 value (e.g. "PROJ-0001").
export type Project = {
  id: string;
  number: number;
  code: string;
  name: string;
  created_at: string;
  archived: boolean;
};

// Aggregated consumption of one part against one project.
export type ProjectUsage = {
  id: string;
  project_id: string;
  part_id: string;
  quantity: number;
  updated_at: string;
};

// A row in a project's usage table (part identity joined in for display).
// `item_no` is the part's scannable item number (its bin's barcode_code).
export type ProjectUsageRow = {
  part_id: string;
  item_no: string;
  description: string;
  quantity: number;
};

// use_part_in_project() returns the same shape as use_part().
export type UsePartInProjectResult = UsePartResult;

// Row returned by the part_stock_list view (supabase/migrations/0009). Same as
// PartStockTotal plus `item_no`, the part's bin barcode. Having the item number
// in the view is what lets /stock sort, search, and page in Postgres instead of
// downloading the whole catalog to do it in the browser. `item_no` is null for
// a part with no bin.
export type PartStockListRow = PartStockTotal & {
  item_no: string | null;
};

// --- Admin accounts and audit trail (supabase/migrations/0014) ------------
//
// These three tables are the only ones in the schema the browser cannot read.
// RLS is on with no policies and no grants, so they are served exclusively by
// authenticated /api/admin/* routes. Nothing here is fetched through the
// browser Supabase client.

export type AdminRole = "owner" | "admin";

// An admin as the application sees one. The password hash is never selected
// into this shape — it stays in the database, where verify_admin_password()
// compares it.
export type AdminUser = {
  id: string;
  username: string;
  display_name: string;
  role: AdminRole;
  active: boolean;
  created_at?: string;
};

// A row of the audit trail. actor_username, actor_name and item_no are copied
// in at write time rather than joined, so the history stays readable after an
// account or a part is deleted.
export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_username: string;
  actor_name: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  item_no: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

// The only password rule, and the whole of it.
//
// Lowered from 8 to 4 on request, so the shop can keep using short numeric
// codes of the kind the old shared PIN trained everyone on. What that costs,
// recorded here rather than rediscovered later: a 4-digit password is ten
// thousand possibilities, and nothing in this system slows an attacker down —
// there is no rate limiting, no lockout, and no delay between sign-in
// attempts. The bcrypt work factor makes each guess cost a few tens of
// milliseconds, which is the only thing standing between a short password and
// an exhaustive search.
//
// Lives here rather than in lib/auth.ts because that module is server-only and
// the account forms need the same number to disable their buttons on.
export const MIN_PASSWORD_LENGTH = 4;

// Sent as `code` on the 403 that means "this token is finished", as opposed to
// the 403 that means "you are signed in but this page is not yours". The
// client ends the session on the first and not the second; without a tag it
// cannot tell them apart, and treating every 403 as fatal signs an admin out
// merely for opening an owner-only page.
export const ACCOUNT_DEACTIVATED = "ACCOUNT_DEACTIVATED";
