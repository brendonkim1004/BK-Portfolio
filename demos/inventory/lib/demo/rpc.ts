// The database functions the real app calls, rewritten in TypeScript against
// the in-memory tables. Each one follows the same steps, returns the same
// shape and fails with the same error word as its SQL original, because the
// pages decide what to show from those.

import { db, emit, itemNoForPart, newId, nextProjectNumber, nowIso } from "./store";
import type { Row } from "./store";

const PROJECT_DONE = "PROJECT-DONE";

// Thrown for the named failures (UNKNOWN_BARCODE, OUT_OF_STOCK, ...).
export class DemoDbError extends Error {}

function fail(code: string): never {
  throw new DemoDbError(code);
}

// --- Shared steps ---------------------------------------------------------

// Find the bin for a barcode and the part in it, or fail the way SQL does.
function binForBarcode(barcode: string): { loc: Row; partId: string } {
  const loc = db.locations.find((l) => l.barcode_code === barcode);
  if (!loc) fail("UNKNOWN_BARCODE");
  if (!loc.part_id) fail("EMPTY_BIN");
  return { loc, partId: loc.part_id as string };
}

function stockRow(partId: string, locationId: string): Row | undefined {
  return db.stock.find(
    (s) => s.part_id === partId && s.location_id === locationId,
  );
}

function logTransaction(
  partId: string,
  locationId: string,
  change: number,
  type: "used" | "restock",
): void {
  db.stock_transactions.push({
    id: newId("txn"),
    part_id: partId,
    location_id: locationId,
    change_qty: change,
    type,
    created_at: nowIso(),
  });
}

// Add to (or create) a project's running total for a part.
function addUsage(projectId: string, partId: string, quantity: number): void {
  const row = db.project_usage.find(
    (u) => u.project_id === projectId && u.part_id === partId,
  );
  if (row) {
    row.quantity += quantity;
    row.updated_at = nowIso();
  } else {
    db.project_usage.push({
      id: newId("usage"),
      project_id: projectId,
      part_id: partId,
      quantity,
      updated_at: nowIso(),
    });
  }
}

// What a successful scan hands back to the scan page.
function scanResult(partId: string, locationId: string, quantity: number): Row[] {
  const part = db.parts.find((p) => p.id === partId);
  return [
    {
      part_id: partId,
      sku: part?.sku,
      description: part?.description,
      location_id: locationId,
      new_quantity: quantity,
    },
  ];
}

// Take one unit out of a bin. Refuses rather than going below zero.
function takeOne(barcode: string): { partId: string; locId: string; qty: number } {
  const { loc, partId } = binForBarcode(barcode);
  const row = stockRow(partId, loc.id);
  if (!row || row.quantity <= 0) fail("OUT_OF_STOCK");
  row.quantity -= 1;
  logTransaction(partId, loc.id, -1, "used");
  return { partId, locId: loc.id, qty: row.quantity };
}

// --- Scanner functions ----------------------------------------------------

// A plain scan: one unit used, not booked to any project.
export function usePart(barcode: string): Row[] {
  const { partId, locId, qty } = takeOne(barcode);
  emit("stock");
  return scanResult(partId, locId, qty);
}

// A scan while a project is active (or into the General bucket).
export function usePartInProject(barcode: string, projectId: string): Row[] {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) fail("UNKNOWN_PROJECT");
  const { partId, locId, qty } = takeOne(barcode);
  addUsage(projectId, partId, 1);
  // The scan log is per unit and never records the General bucket.
  if (project.code !== PROJECT_DONE) {
    db.scan_log.push({
      id: newId("scan"),
      project_id: projectId,
      part_id: partId,
      created_at: nowIso(),
    });
    emit("scan_log");
  }
  emit("stock", "project_usage");
  return scanResult(partId, locId, qty);
}

// A scan in restock mode: one unit added.
export function restockPart(barcode: string): Row[] {
  const { loc, partId } = binForBarcode(barcode);
  let row = stockRow(partId, loc.id);
  if (row) {
    row.quantity += 1;
  } else {
    row = { id: newId("stock"), part_id: partId, location_id: loc.id, quantity: 1 };
    db.stock.push(row);
  }
  logTransaction(partId, loc.id, 1, "restock");
  emit("stock");
  return scanResult(partId, loc.id, row.quantity);
}

// --- Project functions ----------------------------------------------------

export function createProject(name: string): Row[] {
  const trimmed = (name ?? "").trim();
  if (!trimmed) fail("EMPTY_NAME");
  const number = nextProjectNumber();
  const project = {
    id: newId("proj"),
    number,
    code: `PROJ-${String(number).padStart(4, "0")}`,
    name: trimmed,
    archived: false,
    created_at: nowIso(),
  };
  db.projects.push(project);
  emit("projects");
  const { archived: _archived, ...returned } = project;
  return [returned];
}

export function setProjectArchived(projectId: string, archived: boolean): null {
  const project = db.projects.find((p) => p.id === projectId);
  if (project) {
    project.archived = archived;
    emit("projects");
  }
  return null;
}

// Edit a project's total for a part by hand. The difference is also moved in
// stock (in the bin holding the most of that part), never below zero.
export function setProjectUsage(
  projectId: string,
  partId: string,
  quantity: number,
): null {
  if (quantity < 0) fail("NEGATIVE_QUANTITY");

  const existing = db.project_usage.find(
    (u) => u.project_id === projectId && u.part_id === partId,
  );
  const delta = quantity - (existing?.quantity ?? 0);

  if (quantity === 0) {
    db.project_usage = db.project_usage.filter((u) => u !== existing);
  } else if (existing) {
    existing.quantity = quantity;
    existing.updated_at = nowIso();
  } else {
    addUsage(projectId, partId, quantity);
  }
  emit("project_usage");
  if (delta === 0) return null;

  const fullest = db.stock
    .filter((s) => s.part_id === partId)
    .sort((a, b) => b.quantity - a.quantity)[0];
  if (!fullest) return null;

  const before = fullest.quantity as number;
  const after = Math.max(before - delta, 0);
  fullest.quantity = after;
  logTransaction(
    partId,
    fullest.location_id,
    after - before,
    after - before < 0 ? "used" : "restock",
  );
  emit("stock");
  return null;
}

// --- Admin stock moves (used by the fake /api/admin routes) -----------------

export type StockMove = {
  quantity: number; // what the bin holds now
  previous: number; // what it held before
  partId: string;
  itemNo: string | null;
  unbooked?: number; // restock-from-project only: units taken back off the project
};

// A failure with the HTTP status the real route would answer with.
export class StockMoveError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Find the bin by id, its part and its stock row (created at 0 if missing).
function binForMove(locationId: string): { loc: Row; partId: string; row: Row } {
  const loc = db.locations.find((l) => l.id === locationId);
  if (!loc) throw new StockMoveError("Bin not found.", 404);
  if (!loc.part_id) {
    throw new StockMoveError("This bin has no part assigned.", 400);
  }
  let row = stockRow(loc.part_id, locationId);
  if (!row) {
    row = { id: newId("stock"), part_id: loc.part_id, location_id: locationId, quantity: 0 };
    db.stock.push(row);
  }
  return { loc, partId: loc.part_id as string, row };
}

function projectForMove(projectId: string): Row {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) {
    throw new StockMoveError("That project no longer exists.", 400);
  }
  return project;
}

// Add stock. With a project, the same units also come back off that project's
// usage (as many as it has booked), newest scan-log rows first.
export function adminRestock(
  locationId: string,
  quantity: number,
  projectId: string | null,
): StockMove {
  const { loc, partId, row } = binForMove(locationId);
  const project = projectId ? projectForMove(projectId) : null;

  const previous = row.quantity as number;
  row.quantity = previous + quantity;
  logTransaction(partId, locationId, quantity, "restock");
  emit("stock");

  const move: StockMove = {
    quantity: row.quantity,
    previous,
    partId,
    itemNo: loc.barcode_code ?? null,
  };
  if (!project) return move;

  const usage = db.project_usage.find(
    (u) => u.project_id === project.id && u.part_id === partId,
  );
  const unbooked = Math.min(quantity, usage?.quantity ?? 0);
  if (usage && unbooked > 0) {
    if (usage.quantity - unbooked === 0) {
      db.project_usage = db.project_usage.filter((u) => u !== usage);
    } else {
      usage.quantity -= unbooked;
      usage.updated_at = nowIso();
    }
    if (project.code !== PROJECT_DONE) {
      const newest = db.scan_log
        .filter((s) => s.project_id === project.id && s.part_id === partId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, unbooked);
      db.scan_log = db.scan_log.filter((s) => !newest.includes(s));
      emit("scan_log");
    }
    emit("project_usage");
  }
  return { ...move, unbooked };
}

// Remove stock, stopping at zero. With a project, what actually came off is
// booked to that project exactly as if it had been scanned.
export function adminSubtract(
  locationId: string,
  quantity: number,
  projectId: string | null,
): StockMove {
  const { loc, partId, row } = binForMove(locationId);
  const project = projectId ? projectForMove(projectId) : null;

  const previous = row.quantity as number;
  const applied = Math.min(quantity, previous);
  row.quantity = previous - applied;
  emit("stock");

  if (applied > 0) {
    logTransaction(partId, locationId, -applied, "used");
    if (project) {
      addUsage(project.id, partId, applied);
      emit("project_usage");
      if (project.code !== PROJECT_DONE) {
        for (let i = 0; i < applied; i += 1) {
          db.scan_log.push({
            id: newId("scan"),
            project_id: project.id,
            part_id: partId,
            created_at: nowIso(),
          });
        }
        emit("scan_log");
      }
    }
  }
  return {
    quantity: row.quantity,
    previous,
    partId,
    itemNo: loc.barcode_code ?? null,
  };
}

// Set a bin to an exact count (a correction, so no transaction is logged).
export function adminCorrect(locationId: string, quantity: number): StockMove {
  const { loc, partId, row } = binForMove(locationId);
  const previous = row.quantity as number;
  row.quantity = quantity;
  emit("stock");
  return { quantity, previous, partId, itemNo: loc.barcode_code ?? null };
}

// Re-exported so the admin handlers can label entries the same way.
export { itemNoForPart };
