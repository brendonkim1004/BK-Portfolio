// The demo's whole "database": plain arrays held in memory.
//
// The real app talks to Postgres through Supabase. This demo has no backend at
// all, so the tables live here instead. Every name, number, code and date in
// this file is invented. Nothing is saved anywhere: reloading the page starts
// again from the seed below.

export type Row = Record<string, any>;

export type Db = {
  parts: Row[]; // id, sku, description, counted, created_at
  locations: Row[]; // id, barcode_code, part_id, created_at   (a bin carries the barcode)
  stock: Row[]; // id, part_id, location_id, quantity
  stock_transactions: Row[]; // id, part_id, location_id, change_qty, type, created_at
  projects: Row[]; // id, number, code, name, archived, created_at
  project_usage: Row[]; // id, project_id, part_id, quantity, updated_at
  scan_log: Row[]; // id, project_id, part_id, created_at
  favorites: Row[]; // user_id, part_id, sort_order
  admin_users: Row[]; // id, username, display_name, role, active, created_at
  audit_log: Row[]; // id, actor_*, action, entity_*, item_no, summary, details, created_at
};

export type TableName = keyof Db;

// The account the demo is always signed in as.
export const DEMO_USER_ID = "user-owner";

// Reserved codes, repeated from lib/types.ts so this file stands on its own.
const PROJECT_DONE = "PROJECT-DONE";
const TEST_ITEM = "TEST-ITEM";

// --- Ids and time ---------------------------------------------------------

let idCounter = 0;

// A new unique id for a row created while the demo runs.
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-new-${idCounter}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

// A timestamp some days and hours before now, so the history always looks
// recent no matter when the demo is opened.
function ago(days: number, hours = 0, minutes = 0): string {
  const ms = ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

// --- Seed data (all invented) --------------------------------------------

// [bin barcode, description, quantity in the bin]
const SEED_PARTS: [string, string, number][] = [
  ["FST-1001", "Hex bolt M12 x 40, zinc plated", 148],
  ["FST-1002", "Hex bolt M16 x 60, grade 8.8", 96],
  ["FST-1003", "Nyloc nut M12", 210],
  ["FST-1004", "Flat washer M16", 320],
  ["FST-1005", "Socket cap screw M8 x 25", 64],
  ["FST-1006", "Split pin 4 x 40 mm", 85],
  ["HYD-2101", "JIC elbow 90 degree, 3/4 in", 22],
  ["HYD-2102", "JIC straight adapter, 1/2 in", 31],
  ["HYD-2103", "Quick coupler, female, 1/2 in", 1],
  ["HYD-2104", "Hydraulic tee, 3/4 in", 14],
  ["HYD-2105", "Bulkhead fitting, 1 in", 9],
  ["HYD-2106", "Pressure test point, M16", 0],
  ["HOS-3001", "Hydraulic hose 1/2 in x 2 m", 12],
  ["HOS-3002", "Hydraulic hose 3/4 in x 3 m", 7],
  ["HOS-3003", "Grease line 1/4 in x 5 m", 18],
  ["HOS-3004", "Hose clamp 60-80 mm", 54],
  ["HOS-3005", "Spiral hose guard, 10 m roll", 1],
  ["SEL-4001", "O-ring kit, metric assortment", 6],
  ["SEL-4002", "Piston seal 200 mm", 4],
  ["SEL-4003", "Wiper seal 80 mm", 11],
  ["SEL-4004", "Bonded washer 3/4 in", 140],
  ["SEL-4005", "Shaft seal 55 x 72 x 10", 8],
  ["FLT-5001", "Hydraulic return filter element", 10],
  ["FLT-5002", "Engine oil filter, spin-on", 16],
  ["FLT-5003", "Fuel filter / water separator", 13],
  ["FLT-5004", "Air filter, primary", 5],
  ["FLT-5005", "Breather cap filter", 20],
  ["ELC-6001", "Wire 14 AWG red, 30 m spool", 9],
  ["ELC-6002", "Wire 14 AWG black, 30 m spool", 8],
  ["ELC-6003", "Blade fuse 15 A", 75],
  ["ELC-6004", "Relay 24 V, 5-pin", 24],
  ["ELC-6005", "Heat-shrink butt connector, blue", 260],
  ["ELC-6006", "Proximity sensor M18", 3],
  ["ELC-6007", "LED work light 24 V", 6],
  ["PNT-7001", "Spray paint, gloss white", 28],
  ["PNT-7002", "Primer, grey, 1 L", 12],
  ["PNT-7003", "Masking tape 48 mm", 40],
  ["PNT-7004", "Paint thinner 4 L", 5],
  ["SHP-8001", "Grease cartridge, EP2", 60],
  ["SHP-8002", "Cable ties 300 mm, bag of 100", 33],
  ["SHP-8003", "Shop rags, box", 14],
];

function seed(): Db {
  const db: Db = {
    parts: [],
    locations: [],
    stock: [],
    stock_transactions: [],
    projects: [],
    project_usage: [],
    scan_log: [],
    favorites: [],
    admin_users: [],
    audit_log: [],
  };

  // Parts, one bin each, and the stock in that bin.
  const partByCode: Record<string, string> = {};
  let sku = 100;
  const addPart = (
    code: string | null,
    description: string,
    quantity: number,
    counted = true,
  ) => {
    sku += 1;
    const partId = `part-${sku}`;
    db.parts.push({
      id: partId,
      sku,
      description,
      counted,
      created_at: ago(90),
    });
    if (code) {
      const locId = `loc-${sku}`;
      db.locations.push({
        id: locId,
        barcode_code: code,
        part_id: partId,
        created_at: ago(90),
      });
      db.stock.push({
        id: `stock-${sku}`,
        part_id: partId,
        location_id: locId,
        quantity,
      });
      partByCode[code] = partId;
    }
    return partId;
  };

  for (const [code, description, quantity] of SEED_PARTS) {
    addPart(code, description, quantity);
  }
  // One part that was never counted (the stock page shows "N/A" for it), one
  // with no bin yet, one bin with nothing in it, and the scanner test item.
  addPart("SHP-8004", "Thread sealant 50 mL", 0, false);
  addPart(null, "Wear plate blank, 10 mm", 0);
  db.locations.push({
    id: "loc-spare",
    barcode_code: "SPARE-0001",
    part_id: null,
    created_at: ago(30),
  });
  addPart(TEST_ITEM, "Scanner test item", 100);

  // Projects. The first is the reserved "General" bucket normal scans go to.
  db.projects.push(
    {
      id: "proj-general",
      number: 1,
      code: PROJECT_DONE,
      name: "General (Project Done)",
      archived: false,
      created_at: ago(90),
    },
    {
      id: "proj-2",
      number: 2,
      code: "PROJ-0002",
      name: "Yard Lighting Retrofit",
      archived: true,
      created_at: ago(40),
    },
    {
      id: "proj-3",
      number: 3,
      code: "PROJ-0003",
      name: "Boom Truck 12 Hydraulic Refit",
      archived: false,
      created_at: ago(9),
    },
    {
      id: "proj-4",
      number: 4,
      code: "PROJ-0004",
      name: "Hopper Rebuild, Unit 7",
      archived: false,
      created_at: ago(3),
    },
  );

  // What each project has used so far: [project, bin code, quantity, days ago].
  const usage: [string, string, number, number][] = [
    ["proj-general", "FST-1001", 12, 1],
    ["proj-general", "SHP-8001", 4, 2],
    ["proj-general", "ELC-6003", 6, 4],
    ["proj-general", "PNT-7003", 2, 6],
    ["proj-2", "ELC-6007", 4, 31],
    ["proj-2", "ELC-6001", 2, 33],
    ["proj-2", "SHP-8002", 3, 34],
    ["proj-3", "HYD-2101", 6, 1],
    ["proj-3", "HOS-3002", 3, 2],
    ["proj-3", "SEL-4004", 10, 2],
    ["proj-3", "FLT-5001", 2, 5],
    ["proj-4", "SEL-4002", 2, 0],
    ["proj-4", "FST-1002", 8, 1],
    ["proj-4", "SEL-4003", 1, 2],
  ];
  let n = 0;
  for (const [projectId, code, quantity, days] of usage) {
    const partId = partByCode[code];
    n += 1;
    db.project_usage.push({
      id: `usage-${n}`,
      project_id: projectId,
      part_id: partId,
      quantity,
      updated_at: ago(days, 2),
    });
    // The scan log keeps one row per unit, and never for the General bucket.
    if (projectId !== "proj-general") {
      for (let i = 0; i < quantity; i += 1) {
        db.scan_log.push({
          id: `scan-${n}-${i}`,
          project_id: projectId,
          part_id: partId,
          created_at: ago(days, 2, i * 3 + n),
        });
      }
    }
  }

  // Admin accounts. The demo is always signed in as the first one.
  db.admin_users.push(
    {
      id: DEMO_USER_ID,
      username: "demo",
      display_name: "Demo Owner",
      role: "owner",
      active: true,
      created_at: ago(90),
    },
    {
      id: "user-priya",
      username: "priya",
      display_name: "Priya Nair",
      role: "admin",
      active: true,
      created_at: ago(60),
    },
    {
      id: "user-marcus",
      username: "marcus",
      display_name: "Marcus Hale",
      role: "admin",
      active: true,
      created_at: ago(45),
    },
  );

  // A few starred parts for the signed-in account.
  ["FLT-5001", "HYD-2101", "SHP-8001"].forEach((code, i) => {
    db.favorites.push({
      user_id: DEMO_USER_ID,
      part_id: partByCode[code],
      sort_order: i,
    });
  });

  // Activity history, written the way the real routes word their entries.
  const who = {
    demo: { id: DEMO_USER_ID, username: "demo", name: "Demo Owner" },
    priya: { id: "user-priya", username: "priya", name: "Priya Nair" },
    marcus: { id: "user-marcus", username: "marcus", name: "Marcus Hale" },
  };
  const audit = (
    actor: keyof typeof who,
    days: number,
    hours: number,
    action: string,
    entityType: string,
    itemNo: string | null,
    summary: string,
    details: Row,
  ) => {
    db.audit_log.push({
      id: `audit-${db.audit_log.length + 1}`,
      actor_id: who[actor].id,
      actor_username: who[actor].username,
      actor_name: who[actor].name,
      action,
      entity_type: entityType,
      entity_id: null,
      item_no: itemNo,
      summary,
      details,
      created_at: ago(days, hours),
    });
  };
  audit("priya", 0, 3, "stock.restock", "stock", "FLT-5001",
    "Added 6 to FLT-5001 (4 → 10)", { from: 4, to: 10, added: 6 });
  audit("marcus", 0, 5, "stock.subtract_to_project", "stock", "SEL-4002",
    "Removed 2 from SEL-4002 (6 → 4) for #4 Hopper Rebuild, Unit 7",
    { from: 6, to: 4, requested: 2, removed: 2, project: "#4 Hopper Rebuild, Unit 7" });
  audit("demo", 1, 1, "stock.correct", "stock", "HYD-2106",
    "Set HYD-2106 from 2 to 0", { from: 2, to: 0 });
  audit("priya", 1, 4, "part.rename", "part", "HOS-3005",
    'Renamed HOS-3005 "Spiral hose wrap" → "Spiral hose guard, 10 m roll"',
    { from: "Spiral hose wrap", to: "Spiral hose guard, 10 m roll" });
  audit("marcus", 2, 2, "stock.subtract", "stock", "PNT-7004",
    "Removed 1 from PNT-7004 (6 → 5)", { from: 6, to: 5, requested: 1, removed: 1 });
  audit("demo", 3, 0, "project.rename", "project", null,
    'Renamed PROJ-0004 "Hopper Rebuild" → "Hopper Rebuild, Unit 7"',
    { project_code: "PROJ-0004", previous: "Hopper Rebuild", next: "Hopper Rebuild, Unit 7" });
  audit("priya", 3, 6, "stock.restock", "stock", "FST-1004",
    "Added 200 to FST-1004 (120 → 320)", { from: 120, to: 320, added: 200 });
  audit("priya", 4, 2, "part.create", "part", "ELC-6007",
    'Created part ELC-6007 "LED work light 24 V" starting at 10',
    { description: "LED work light 24 V", item_no: "ELC-6007", quantity: 10 });
  audit("marcus", 5, 3, "stock.correct", "stock", "ELC-6006",
    "Set ELC-6006 from 5 to 3", { from: 5, to: 3 });
  audit("demo", 6, 1, "bin.create", "bin", "SPARE-0001",
    "Created empty bin SPARE-0001", { barcode_code: "SPARE-0001", part_id: null });
  audit("marcus", 8, 4, "stock.restock", "stock", "SHP-8001",
    "Added 24 to SHP-8001 (40 → 64)", { from: 40, to: 64, added: 24 });
  audit("priya", 12, 2, "bin.rename", "bin", "SEL-4005",
    "Renamed bin SEL-4050 → SEL-4005", { from: "SEL-4050", to: "SEL-4005" });
  audit("demo", 20, 5, "log.clear_project", "log", null,
    'Cleared usage for PROJECT-DONE "General (Project Done)" (9 parts)',
    { project_code: "PROJECT-DONE", project_name: "General (Project Done)", removed: 9 });
  audit("demo", 45, 0, "user.create", "user", null,
    'Created admin account "marcus" for Marcus Hale',
    { username: "marcus", display_name: "Marcus Hale", role: "admin" });
  audit("demo", 60, 0, "user.create", "user", null,
    'Created admin account "priya" for Priya Nair',
    { username: "priya", display_name: "Priya Nair", role: "admin" });

  return db;
}

// The live tables. `db` is replaced wholesale by resetDemo(), so always read
// it through this module (import { db }) rather than keeping a copy.
export let db: Db = seed();

// --- Change emitter -------------------------------------------------------
//
// Stands in for Supabase realtime: anything that changes a table calls
// emit(table), and every page subscribed to that table refetches.

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribe(table: TableName, fn: Listener): () => void {
  let set = listeners.get(table);
  if (!set) {
    set = new Set();
    listeners.set(table, set);
  }
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

// Listeners run a moment later, like a realtime event arriving, so a page
// never refetches in the middle of the change that caused it.
export function emit(...tables: TableName[]): void {
  for (const table of tables) {
    const set = listeners.get(table);
    if (!set) continue;
    for (const fn of [...set]) setTimeout(fn, 0);
  }
}

// Put every table back to the seed data and tell every page.
export function resetDemo(): void {
  db = seed();
  emit(...(Object.keys(db) as TableName[]));
}

// --- Small lookups shared by the fake client and the fake admin API --------

// A part's item number is the lowest barcode among the bins that hold it
// (the same rule as the part_stock_list view in the real database).
export function itemNoForPart(partId: string): string | null {
  const codes = db.locations
    .filter((l) => l.part_id === partId)
    .map((l) => l.barcode_code as string)
    .sort();
  return codes[0] ?? null;
}

// The part_stock_list view: one row per part with its total across bins.
export function partStockList(): Row[] {
  return db.parts.map((p) => ({
    part_id: p.id,
    sku: p.sku,
    description: p.description,
    counted: p.counted,
    total_quantity: db.stock
      .filter((s) => s.part_id === p.id)
      .reduce((sum, s) => sum + (s.quantity as number), 0),
    item_no: itemNoForPart(p.id),
  }));
}

// The quantity currently in the bin with this barcode, or null if there is no
// such bin. Used by the clickable sample labels on the scan page.
export function binQuantity(barcode: string): number | null {
  const loc = db.locations.find((l) => l.barcode_code === barcode);
  if (!loc) return null;
  const row = db.stock.find(
    (s) => s.location_id === loc.id && s.part_id === loc.part_id,
  );
  return row ? (row.quantity as number) : 0;
}

export function nextSku(): number {
  return db.parts.reduce((max, p) => Math.max(max, p.sku as number), 0) + 1;
}

export function nextProjectNumber(): number {
  return db.projects.reduce((max, p) => Math.max(max, p.number as number), 0) + 1;
}
