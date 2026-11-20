// The demo's stand-in for the /api/admin/* server routes.
//
// In the real app these run on the server with a privileged database key.
// Here each one is a plain function over the in-memory tables. They check the
// same things, answer with the same JSON, word their errors the same way and
// write the same activity-log entry, so the admin pages behave as they do in
// production.

import {
  DEMO_USER_ID,
  db,
  emit,
  itemNoForPart,
  newId,
  nextSku,
  nowIso,
} from "./store";
import type { Row } from "./store";
import {
  StockMoveError,
  adminCorrect,
  adminRestock,
  adminSubtract,
} from "./rpc";

const PROJECT_DONE = "PROJECT-DONE";
const RESTOCK_MODE = "RESTOCK-MODE";
const TEST_ITEM = "TEST-ITEM";
const MIN_PASSWORD_LENGTH = 4;

// A refused request: the message the page shows and the HTTP status the real
// route would have used.
export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const bad = (message: string) => new HttpError(message, 400);
const notFound = (message: string) => new HttpError(message, 404);

// --- Who is signed in -----------------------------------------------------

// The demo is always signed in as the owner account.
export function currentUser(): Row {
  const row = db.admin_users.find((u) => u.id === DEMO_USER_ID);
  return {
    id: DEMO_USER_ID,
    username: row?.username ?? "demo",
    display_name: row?.display_name ?? "Demo Owner",
    role: "owner",
  };
}

// --- Activity log ---------------------------------------------------------

type AuditEntry = {
  action: string;
  entity_type?: string;
  entity_id?: string | null;
  item_no?: string | null;
  summary: string;
  details?: Row | null;
};

// Every admin write ends by recording who did what.
function recordAudit(entry: AuditEntry): void {
  const actor = currentUser();
  db.audit_log.push({
    id: newId("audit"),
    actor_id: actor.id,
    actor_username: actor.username,
    actor_name: actor.display_name,
    action: entry.action,
    entity_type: entry.entity_type ?? null,
    entity_id: entry.entity_id ?? null,
    item_no: entry.item_no ?? null,
    summary: entry.summary,
    details: entry.details ?? null,
    created_at: nowIso(),
  });
  emit("audit_log");
}

// --- Small checks shared by several routes ---------------------------------

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function wholeNumber(value: unknown): number | null {
  const n =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function reservedBarcodeError(barcode: string): string | null {
  return [PROJECT_DONE, RESTOCK_MODE].includes(barcode.toUpperCase())
    ? `"${barcode}" is reserved by the scanner and can't be a bin barcode.`
    : null;
}

function barcodeTaken(barcode: string, exceptId?: string): boolean {
  return db.locations.some((l) => l.barcode_code === barcode && l.id !== exceptId);
}

function projectLabel(projectId: string | null): string | null {
  const p = projectId ? db.projects.find((x) => x.id === projectId) : null;
  return p ? `#${p.number} ${p.name}` : null;
}

// Run a stock move and turn its failure into a refused request.
function move<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof StockMoveError) throw new HttpError(err.message, err.status);
    throw err;
  }
}

// The location, quantity and optional project every stock form sends.
function stockBody(body: Row, minimum: 0 | 1) {
  const locationId = typeof body.location_id === "string" ? body.location_id : "";
  if (!locationId) throw bad("location_id is required.");
  const quantity = wholeNumber(body.quantity);
  if (quantity === null || quantity < minimum) {
    throw bad(`Quantity must be a whole number of ${minimum} or more.`);
  }
  const projectId =
    typeof body.project_id === "string" && body.project_id.trim() !== ""
      ? body.project_id
      : null;
  return { locationId, quantity, projectId };
}

// --- Stock: restock, subtract, correct --------------------------------------

function postRestock(body: Row) {
  const { locationId, quantity, projectId } = stockBody(body, 1);
  const result = move(() => adminRestock(locationId, quantity, projectId));
  const label = result.itemNo ?? "an unnumbered bin";
  const project = projectLabel(projectId);
  const unbooked = result.unbooked ?? 0;

  recordAudit({
    action: projectId ? "stock.restock_from_project" : "stock.restock",
    entity_type: "stock",
    entity_id: locationId,
    item_no: result.itemNo,
    summary:
      `Added ${quantity} to ${label} (${result.previous} → ${result.quantity})` +
      (project ? `, removed ${unbooked} from ${project}` : ""),
    details: {
      from: result.previous,
      to: result.quantity,
      added: quantity,
      ...(projectId ? { project_id: projectId, project, unbooked } : {}),
    },
  });
  return { quantity: result.quantity, ...(projectId ? { unbooked } : {}) };
}

function postSubtract(body: Row) {
  const { locationId, quantity, projectId } = stockBody(body, 1);
  const result = move(() => adminSubtract(locationId, quantity, projectId));
  const applied = result.previous - result.quantity;
  const label = result.itemNo ?? "an unnumbered bin";
  const project = projectLabel(projectId);

  recordAudit({
    action: projectId ? "stock.subtract_to_project" : "stock.subtract",
    entity_type: "stock",
    entity_id: locationId,
    item_no: result.itemNo,
    summary:
      `Removed ${applied} from ${label} (${result.previous} → ${result.quantity})` +
      (project ? ` for ${project}` : ""),
    details: {
      from: result.previous,
      to: result.quantity,
      requested: quantity,
      removed: applied,
      ...(projectId ? { project_id: projectId, project } : {}),
    },
  });
  return { quantity: result.quantity };
}

function postCorrect(body: Row) {
  const { locationId, quantity } = stockBody(body, 0);
  const result = move(() => adminCorrect(locationId, quantity));
  const label = result.itemNo ?? "an unnumbered bin";

  recordAudit({
    action: "stock.correct",
    entity_type: "stock",
    entity_id: locationId,
    item_no: result.itemNo,
    summary: `Set ${label} from ${result.previous} to ${result.quantity}`,
    details: { from: result.previous, to: result.quantity },
  });
  return { quantity: result.quantity };
}

// --- Parts ----------------------------------------------------------------

const partOut = (p: Row) => ({
  id: p.id,
  sku: p.sku,
  description: p.description,
  created_at: p.created_at,
});

const locationOut = (l: Row) => ({
  id: l.id,
  barcode_code: l.barcode_code,
  part_id: l.part_id,
  created_at: l.created_at,
});

function postPart(body: Row) {
  const description = text(body.description);
  if (!description) throw bad("Description is required.");

  const itemNo = text(body.item_no);
  if (itemNo) {
    const reserved = reservedBarcodeError(itemNo);
    if (reserved) throw bad(reserved);
  }

  const quantity =
    body.quantity === undefined || body.quantity === null || body.quantity === ""
      ? 0
      : wholeNumber(body.quantity);
  if (quantity === null) {
    throw bad("Starting quantity must be a whole number of 0 or more.");
  }
  if (quantity > 0 && !itemNo) {
    throw bad(
      "Give the part an item number to start it with a quantity — stock is counted per bin.",
    );
  }
  if (itemNo && barcodeTaken(itemNo)) {
    throw bad(`Item number "${itemNo}" is already in use.`);
  }

  const part = {
    id: newId("part"),
    sku: nextSku(),
    description,
    counted: true,
    created_at: nowIso(),
  };
  db.parts.push(part);
  emit("parts");

  if (!itemNo) {
    recordAudit({
      action: "part.create",
      entity_type: "part",
      entity_id: part.id,
      summary: `Created part "${description}" with no item number`,
      details: { description },
    });
    return { part: partOut(part) };
  }

  const location = {
    id: newId("loc"),
    barcode_code: itemNo,
    part_id: part.id,
    created_at: nowIso(),
  };
  db.locations.push(location);
  db.stock.push({
    id: newId("stock"),
    part_id: part.id,
    location_id: location.id,
    quantity,
  });
  emit("locations", "stock");

  recordAudit({
    action: "part.create",
    entity_type: "part",
    entity_id: part.id,
    item_no: itemNo,
    summary: `Created part ${itemNo} "${description}" starting at ${quantity}`,
    details: { description, item_no: itemNo, quantity },
  });
  return { part: partOut(part), location: locationOut(location), quantity };
}

function patchPart(body: Row) {
  const partId = typeof body.part_id === "string" ? body.part_id : "";
  if (!partId) throw bad("part_id is required.");
  const description = text(body.description);
  if (!description) throw bad("Description is required.");

  const part = db.parts.find((p) => p.id === partId);
  if (!part) throw notFound("Part not found.");

  const before = part.description;
  part.description = description;
  emit("parts");

  const itemNo = itemNoForPart(partId);
  recordAudit({
    action: "part.rename",
    entity_type: "part",
    entity_id: partId,
    item_no: itemNo,
    summary: `Renamed ${itemNo ?? "part"} "${before}" → "${description}"`,
    details: { from: before, to: description },
  });
  return { part: partOut(part) };
}

function deletePart(body: Row) {
  const partId = typeof body.part_id === "string" ? body.part_id : "";
  if (!partId) throw bad("part_id is required.");
  const confirm = text(body.confirm);
  if (!confirm) throw bad("Type the item number to confirm.");

  const part = db.parts.find((p) => p.id === partId);
  if (!part) throw notFound("Part not found.");

  const barcodes = db.locations
    .filter((l) => l.part_id === partId)
    .map((l) => l.barcode_code as string)
    .sort();

  if (barcodes.includes(TEST_ITEM)) {
    throw bad(
      "The scanner test item can't be deleted — /scan and /test-item depend on it.",
    );
  }
  const expected = barcodes[0] ?? (part.description as string);
  if (confirm !== expected) {
    throw bad(`Type "${expected}" exactly to confirm the deletion.`);
  }

  // Deleting a part frees its bins and removes everything counted against it.
  db.parts = db.parts.filter((p) => p.id !== partId);
  for (const l of db.locations) if (l.part_id === partId) l.part_id = null;
  db.stock = db.stock.filter((s) => s.part_id !== partId);
  db.stock_transactions = db.stock_transactions.filter((t) => t.part_id !== partId);
  db.project_usage = db.project_usage.filter((u) => u.part_id !== partId);
  db.scan_log = db.scan_log.filter((s) => s.part_id !== partId);
  db.favorites = db.favorites.filter((f) => f.part_id !== partId);
  emit("parts", "locations", "stock", "project_usage", "scan_log", "favorites");

  recordAudit({
    action: "part.delete",
    entity_type: "part",
    entity_id: partId,
    item_no: barcodes[0] ?? null,
    summary: `Deleted part ${barcodes[0] ?? "(no item number)"} "${part.description}"`,
    details: { description: part.description, freed_bins: barcodes },
  });
  return { deleted: partId, freedBins: barcodes };
}

// --- Bins (locations) -------------------------------------------------------

function postLocation(body: Row) {
  const barcode = text(body.barcode_code);
  if (!barcode) throw bad("Barcode is required.");
  const reserved = reservedBarcodeError(barcode);
  if (reserved) throw bad(reserved);
  const partId = typeof body.part_id === "string" && body.part_id ? body.part_id : null;
  if (barcodeTaken(barcode)) throw bad("A bin with that barcode already exists.");

  const location = {
    id: newId("loc"),
    barcode_code: barcode,
    part_id: partId,
    created_at: nowIso(),
  };
  db.locations.push(location);
  emit("locations");

  recordAudit({
    action: "bin.create",
    entity_type: "bin",
    entity_id: location.id,
    item_no: barcode,
    summary: partId
      ? `Created bin ${barcode} and assigned a part to it`
      : `Created empty bin ${barcode}`,
    details: { barcode_code: barcode, part_id: partId },
  });
  return { location: locationOut(location) };
}

function patchLocation(body: Row) {
  const locationId = typeof body.location_id === "string" ? body.location_id : "";
  if (!locationId) throw bad("location_id is required.");

  const patch: { part_id?: string | null; barcode_code?: string } = {};
  if ("part_id" in body) {
    patch.part_id = typeof body.part_id === "string" && body.part_id ? body.part_id : null;
  }
  if ("barcode_code" in body) {
    const barcode = text(body.barcode_code);
    if (!barcode) throw bad("Barcode can't be empty.");
    const reserved = reservedBarcodeError(barcode);
    if (reserved) throw bad(reserved);
    patch.barcode_code = barcode;
  }
  if (Object.keys(patch).length === 0) throw bad("Nothing to update.");

  const location = db.locations.find((l) => l.id === locationId);
  if (!location) throw notFound("Bin not found.");
  const existing = { barcode_code: location.barcode_code, part_id: location.part_id };

  // The scanner test bin is protected: pages print and scan its barcode.
  if (existing.barcode_code === TEST_ITEM) {
    if (patch.barcode_code && patch.barcode_code !== TEST_ITEM) {
      throw bad(
        "The scanner test bin can't be renamed — /test-item prints this barcode.",
      );
    }
    if ("part_id" in patch && patch.part_id === null) {
      throw bad(
        "The scanner test bin can't be emptied — /scan and /test-item depend on the part in it.",
      );
    }
  }
  if (patch.barcode_code && barcodeTaken(patch.barcode_code, locationId)) {
    throw bad("A bin with that barcode already exists.");
  }

  if (patch.barcode_code) location.barcode_code = patch.barcode_code;
  if ("part_id" in patch && patch.part_id !== existing.part_id) {
    location.part_id = patch.part_id;
    // The count belonged to the part that was in the bin, so it goes with it.
    db.stock = db.stock.filter((s) => s.location_id !== locationId);
    emit("stock");
  }
  emit("locations");

  const barcode = patch.barcode_code ?? existing.barcode_code;
  const log = (action: string, summary: string, details: Row) =>
    recordAudit({
      action,
      summary,
      details,
      entity_type: "bin",
      entity_id: locationId,
      item_no: barcode,
    });

  if (patch.barcode_code && patch.barcode_code !== existing.barcode_code) {
    log("bin.rename", `Renamed bin ${existing.barcode_code} → ${patch.barcode_code}`, {
      from: existing.barcode_code,
      to: patch.barcode_code,
    });
  }
  if ("part_id" in patch && patch.part_id !== existing.part_id) {
    if (patch.part_id === null) {
      log("bin.detach", `Emptied bin ${barcode}`, { from_part_id: existing.part_id });
    } else {
      log("bin.assign", `Assigned a part to bin ${barcode}`, {
        from_part_id: existing.part_id,
        to_part_id: patch.part_id,
      });
    }
  }
  return { location: locationOut(location) };
}

// --- Projects (rename) ------------------------------------------------------

const MAX_PROJECT_NAME = 120;

function postProject(body: Row) {
  const projectId = typeof body.project_id === "string" ? body.project_id : "";
  if (!projectId) throw bad("project_id is required.");
  const name = text(body.name);
  if (!name) throw bad("Enter a project name.");
  if (name.length > MAX_PROJECT_NAME) {
    throw bad(`Keep the name under ${MAX_PROJECT_NAME} characters.`);
  }

  const project = db.projects.find((p) => p.id === projectId);
  if (!project) throw notFound("Project not found.");
  if (project.code === PROJECT_DONE) throw bad("The General list can't be renamed.");

  const previous = project.name as string;
  if (previous === name) return { project: { ...project } };

  project.name = name;
  emit("projects");

  recordAudit({
    action: "project.rename",
    entity_type: "project",
    entity_id: projectId,
    summary: `Renamed ${project.code} "${previous}" → "${name}"`,
    details: { project_code: project.code, previous, next: name },
  });
  return { project: { ...project } };
}

// --- Favourites (per account) -----------------------------------------------

function myFavorites(): Row[] {
  return db.favorites
    .filter((f) => f.user_id === DEMO_USER_ID)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function getFavorites() {
  return { part_ids: myFavorites().map((f) => f.part_id as string) };
}

function postFavorite(body: Row) {
  const partId = typeof body.part_id === "string" ? body.part_id : "";
  if (!partId) throw bad("part_id is required.");
  if (typeof body.on !== "boolean") throw bad("`on` must be true or false.");

  const mine = myFavorites();
  const has = mine.some((f) => f.part_id === partId);
  if (body.on && !has) {
    const last = mine.length > 0 ? mine[mine.length - 1].sort_order : -1;
    db.favorites.push({ user_id: DEMO_USER_ID, part_id: partId, sort_order: last + 1 });
  }
  if (!body.on) {
    db.favorites = db.favorites.filter(
      (f) => !(f.user_id === DEMO_USER_ID && f.part_id === partId),
    );
  }
  return { ok: true };
}

function patchFavorites(body: Row) {
  if (!Array.isArray(body.part_ids) || body.part_ids.some((id: unknown) => typeof id !== "string")) {
    throw bad("part_ids must be an array of part ids.");
  }
  const order = body.part_ids as string[];
  for (const f of db.favorites) {
    if (f.user_id !== DEMO_USER_ID) continue;
    const index = order.indexOf(f.part_id);
    if (index !== -1) f.sort_order = index;
  }
  return { ok: true };
}

// --- People (owner only) ----------------------------------------------------

const userOut = (u: Row) => ({
  id: u.id,
  username: u.username,
  display_name: u.display_name,
  role: u.role,
  active: u.active,
  created_at: u.created_at,
});

const isRole = (value: unknown) => value === "owner" || value === "admin";

// Passwords are checked for length like the real form, then thrown away:
// the demo never stores one.
function passwordError(password: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

// There must always be one active owner left.
function lastOwnerGuard(target: Row, verb: string): void {
  if (target.role !== "owner" || !target.active) return;
  const owners = db.admin_users.filter((u) => u.role === "owner" && u.active);
  if (owners.length <= 1) {
    throw bad(
      `This is the last active owner — make someone else an owner before you ${verb} them.`,
    );
  }
}

function getUsers() {
  const users = [...db.admin_users].sort((a, b) =>
    String(a.display_name).localeCompare(String(b.display_name)),
  );
  return { users: users.map(userOut) };
}

function postUser(body: Row) {
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!username) throw bad("Username is required.");
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw bad("Username can only contain letters, numbers, dots, dashes and underscores.");
  }
  const displayName = text(body.display_name);
  if (!displayName) throw bad("Display name is required.");
  if (!isRole(body.role)) throw bad("Role must be owner or admin.");
  const pwError = passwordError(body.password);
  if (pwError) throw bad(pwError);
  if (db.admin_users.some((u) => u.username === username)) {
    throw bad("That username is already taken.");
  }

  const user = {
    id: newId("user"),
    username,
    display_name: displayName,
    role: body.role,
    active: true,
    created_at: nowIso(),
  };
  db.admin_users.push(user);
  emit("admin_users");

  recordAudit({
    action: "user.create",
    entity_type: "user",
    entity_id: user.id,
    summary: `Created ${body.role} account "${username}" for ${displayName}`,
    details: { username, display_name: displayName, role: body.role },
  });
  return { user: userOut(user) };
}

function patchUser(body: Row) {
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!userId) throw bad("user_id is required.");

  const settingActive = typeof body.active === "boolean";
  const settingPassword = body.password !== undefined;
  const settingName = body.display_name !== undefined;
  const settingRole = body.role !== undefined;
  if (!settingActive && !settingPassword && !settingName && !settingRole) {
    throw bad("Nothing to change.");
  }

  const user = db.admin_users.find((u) => u.id === userId);
  if (!user) throw notFound("Account not found.");
  const before = { ...user };

  // Demo-only rule: the account the demo is signed in as stays an active
  // owner, otherwise the owner-only pages would lock themselves.
  if (
    userId === DEMO_USER_ID &&
    ((settingRole && body.role !== "owner") || (settingActive && body.active === false))
  ) {
    throw bad("The demo account stays an active owner so every page keeps working.");
  }

  // Check everything first, then apply, so a refused change alters nothing.
  let displayName = "";
  if (settingName) {
    displayName = text(body.display_name);
    if (!displayName) throw bad("Display name is required.");
  }
  if (settingRole) {
    if (!isRole(body.role)) throw bad("Role must be owner or admin.");
    if (body.role === "admin") lastOwnerGuard(user, "demote");
  }
  if (settingActive && !body.active) lastOwnerGuard(user, "deactivate");
  if (settingPassword) {
    const pwError = passwordError(body.password);
    if (pwError) throw bad(pwError);
  }

  if (settingName) user.display_name = displayName;
  if (settingRole) user.role = body.role;
  if (settingActive) user.active = body.active;
  emit("admin_users");

  const who = `${before.display_name} (${before.username})`;
  const changes: { action: string; summary: string }[] = [];
  if (settingName) {
    changes.push({ action: "user.rename", summary: `Renamed ${who} to ${displayName}` });
  }
  if (settingRole) {
    const promoting = body.role === "owner";
    changes.push({
      action: promoting ? "user.promote" : "user.demote",
      summary: `${promoting ? "Promoted" : "Demoted"} ${who} from ${before.role} to ${body.role}`,
    });
  }
  if (settingActive) {
    const reactivating = body.active === true;
    changes.push({
      action: reactivating ? "user.reactivate" : "user.deactivate",
      summary: `${reactivating ? "Reactivated" : "Deactivated"} ${who}`,
    });
  }
  if (settingPassword) {
    changes.push({
      action: "user.reset_password",
      summary: `Reset the password for ${who}`,
    });
  }

  recordAudit({
    action: changes.map((c) => c.action).join("+"),
    entity_type: "user",
    entity_id: userId,
    summary: changes.map((c) => c.summary).join("; "),
    details: {
      username: before.username,
      ...(settingName
        ? { display_name: { from: before.display_name, to: displayName } }
        : {}),
      ...(settingRole ? { role: { from: before.role, to: body.role } } : {}),
      ...(settingActive ? { active: { from: before.active, to: body.active } } : {}),
      ...(settingPassword ? { password_reset: true } : {}),
    },
  });
  return { user: userOut(user) };
}

function deleteUser(body: Row) {
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!userId) throw bad("user_id is required.");
  if (userId === DEMO_USER_ID) {
    throw bad("You cannot delete your own account — ask another owner to.");
  }
  const user = db.admin_users.find((u) => u.id === userId);
  if (!user) throw notFound("Account not found.");
  lastOwnerGuard(user, "delete");

  db.admin_users = db.admin_users.filter((u) => u.id !== userId);
  db.favorites = db.favorites.filter((f) => f.user_id !== userId);
  emit("admin_users");

  recordAudit({
    action: "user.delete",
    entity_type: "user",
    summary: `Deleted the ${user.role} account "${user.username}" (${user.display_name})`,
    details: {
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      was_active: user.active,
    },
  });
  return { ok: true };
}

// --- Activity log page ------------------------------------------------------

function getActivity(params: URLSearchParams) {
  const offset = Math.max(0, Number(params.get("offset") ?? 0) || 0);
  const limit = Math.min(200, Math.max(1, Number(params.get("limit") ?? 50) || 50));
  const actorId = params.get("actor_id") ?? "";
  const itemNo = (params.get("item_no") ?? "").trim().toLowerCase();

  const newestFirst = [...db.audit_log].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  );
  let matching = newestFirst;
  if (actorId) matching = matching.filter((r) => r.actor_id === actorId);
  if (itemNo) {
    matching = matching.filter((r) =>
      String(r.item_no ?? "").toLowerCase().includes(itemNo),
    );
  }

  // The first page also carries the list of people for the filter.
  let actors: { id: string; name: string }[] | undefined;
  if (offset === 0) {
    const seen = new Map<string, string>();
    for (const r of newestFirst) {
      if (r.actor_id && !seen.has(r.actor_id)) seen.set(r.actor_id, r.actor_name);
    }
    actors = [...seen].map(([id, name]) => ({ id, name }));
    actors.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    rows: matching.slice(offset, offset + limit).map((r) => ({ ...r })),
    total: matching.length,
    offset,
    limit,
    ...(actors ? { actors } : {}),
  };
}

// --- Clearing logs ----------------------------------------------------------

function postClearProject(body: Row) {
  const projectId = typeof body.project_id === "string" ? body.project_id : "";
  if (!projectId) throw bad("project_id is required.");
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) throw notFound("Project not found.");

  const removed = db.project_usage.filter((u) => u.project_id === projectId).length;
  db.project_usage = db.project_usage.filter((u) => u.project_id !== projectId);
  emit("project_usage");

  recordAudit({
    action: "log.clear_project",
    entity_type: "log",
    entity_id: projectId,
    summary: `Cleared usage for ${project.code} "${project.name}" (${removed} ${
      removed === 1 ? "part" : "parts"
    })`,
    details: { project_code: project.code, project_name: project.name, removed },
  });
  return { removed };
}

function postClearScans() {
  const removed = db.scan_log.length;
  db.scan_log = [];
  emit("scan_log");

  recordAudit({
    action: "log.clear_scans",
    entity_type: "log",
    summary: `Cleared the scan log (${removed} ${removed === 1 ? "entry" : "entries"})`,
    details: { removed },
  });
  return { removed };
}

// --- Dispatch ---------------------------------------------------------------

// "METHOD /path" to the function that answers it.
const ROUTES: Record<string, (body: Row, params: URLSearchParams) => unknown> = {
  "GET /api/admin/session": () => ({ user: currentUser() }),
  "DELETE /api/admin/session": () => ({ ok: true }),
  "POST /api/admin/restock": postRestock,
  "POST /api/admin/subtract": postSubtract,
  "POST /api/admin/correct": postCorrect,
  "POST /api/admin/parts": postPart,
  "PATCH /api/admin/parts": patchPart,
  "DELETE /api/admin/parts": deletePart,
  "POST /api/admin/locations": postLocation,
  "PATCH /api/admin/locations": patchLocation,
  "POST /api/admin/projects": postProject,
  "GET /api/admin/favorites": getFavorites,
  "POST /api/admin/favorites": postFavorite,
  "PATCH /api/admin/favorites": patchFavorites,
  "GET /api/admin/users": getUsers,
  "POST /api/admin/users": postUser,
  "PATCH /api/admin/users": patchUser,
  "DELETE /api/admin/users": deleteUser,
  "GET /api/admin/activity": (_body, params) => getActivity(params),
  "POST /api/admin/logs/clear-project": postClearProject,
  "POST /api/admin/logs/clear-scans": postClearScans,
};

// Answer one admin request. Throws HttpError when the real route would have
// replied with an error status.
export function handleAdminRequest(method: string, path: string, body: unknown): unknown {
  const [route, query = ""] = path.split("?");
  const handler = ROUTES[`${method} ${route.replace(/\/$/, "")}`];
  if (!handler) throw new HttpError("Not found.", 404);
  const safeBody = body && typeof body === "object" ? (body as Row) : {};
  return handler(safeBody, new URLSearchParams(query));
}
