// Made-up data for the portfolio demo of the production tracker, plus a tiny stand-in for the
// database client. Nothing here is real: customers, VINs, pump models, people and phone numbers
// are all invented, and nothing is sent anywhere. Changes live in memory and vanish on reload.

const DAY = 86400000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();
const day = (daysAgo) => iso(daysAgo).slice(0, 10);

let nextId = 1;
const id = () => `demo-${nextId++}`;

// One truck row, in the same shape the real database table uses.
function truck(model, truckNumber, vin, customer, extra = {}) {
  return {
    id: id(),
    model,
    truck_number: truckNumber,
    vin,
    customer,
    start_date: null,
    assigned_to: '',
    pump_arrival: '',
    truck_arrival: '',
    current_step: 1,
    status: 'pending',
    pause_reason: null,
    archive: false,
    completion_date: null,
    step_started_at: null,
    production_started_at: null,
    paused_at: null,
    paused_seconds_accumulated: 0,
    eta_override: null,
    created_at: iso(60),
    ...extra,
  };
}

// A truck that started "daysAgo" days ago and is now on "step".
const started = (daysAgo, step, extra = {}) => ({
  status: 'in_progress',
  start_date: day(daysAgo),
  production_started_at: iso(daysAgo),
  step_started_at: iso(Math.min(daysAgo, 2)),
  current_step: step,
  created_at: iso(daysAgo + 10),
  ...extra,
});

// A finished truck in the archive.
const finished = (startedAgo, doneAgo) => ({
  ...started(startedAgo, 12),
  status: 'completed',
  archive: true,
  completion_date: day(doneAgo),
});

function freshTables() {
  nextId = 1;
  return {
    trucks: [
      truck('CX-38 Boom', 'T-2231', '1DEMO38CX0A000231', 'Northgate Concrete', started(31, 9)),
      truck('CX-47 Boom', 'T-2228', '1DEMO47CX0A000228', 'Harbourline Pumping', started(40, 11)),
      truck('LP-70 Line Pump', 'T-2240', '1DEMO70LP0A000240', 'Cedar Ridge Construction', started(12, 6)),
      truck('CX-32 Boom', 'T-2236', '1DEMO32CX0A000236', 'Maple Fork Ready Mix', started(18, 4, {
        status: 'paused',
        pause_reason: 'Waiting on parts',
        paused_at: iso(3),
      })),
      truck('TR-20 Trailer', 'T-2243', '1DEMO20TR0A000243', 'Skyline Foundations', started(5, 2)),
      truck('CX-56 Boom', 'T-2247', '1DEMO56CX0A000247', 'Bluewater Concrete', {
        pump_arrival: 'Arrived', truck_arrival: 'Next week', created_at: iso(6),
      }),
      truck('CX-38 Boom', 'T-2249', '1DEMO38CX0A000249', 'TBD', {
        pump_arrival: 'In transit', truck_arrival: 'TBD', created_at: iso(4),
      }),
      truck('LP-70 Line Pump', 'T-2250', '1DEMO70LP0A000250', 'Granite Peak Builders', {
        pump_arrival: 'Arrived', truck_arrival: 'Arrived', created_at: iso(2),
      }),
      truck('CX-32 Boom', 'T-2210', '1DEMO32CX0A000210', 'Ironwood Paving', finished(75, 28)),
      truck('TR-20 Trailer', 'T-2204', '1DEMO20TR0A000204', 'Lakeshore Pumping', finished(60, 35)),
      truck('CX-47 Boom', 'T-2198', '1DEMO47CX0A000198', 'Summit Concrete Works', finished(120, 62)),
    ],
    notification_recipients: [
      { id: id(), name: 'Avery Lindqvist', phone: '+16045550142', groups: ['office'], active: true, created_at: iso(90) },
      { id: id(), name: 'Jordan Okafor', phone: '+16045550177', groups: ['production_manager'], active: true, created_at: iso(80) },
      { id: id(), name: 'Sam Petrov', phone: '+16045550119', groups: ['paint_manager', 'production_manager'], active: false, created_at: iso(70) },
    ],
  };
}

let tables = freshTables();
export function resetDemo() {
  tables = freshTables();
}

// A query against one in-memory table. It copies just enough of the real database client
// (select, insert, update, delete, eq, order, single) for app.js to run unchanged.
class Query {
  constructor(table) {
    this.table = table;
    this.action = 'select';
    this.filters = [];
    this.sort = null;
    this.one = false;
  }
  select() { return this; }
  insert(row) { this.action = 'insert'; this.payload = row; return this; }
  update(fields) { this.action = 'update'; this.payload = fields; return this; }
  delete() { this.action = 'delete'; return this; }
  eq(column, value) { this.filters.push([column, value]); return this; }
  order(column, { ascending = true } = {}) { this.sort = { column, ascending }; return this; }
  single() { this.one = true; return this; }

  run() {
    const all = tables[this.table];
    const matches = (row) => this.filters.every(([column, value]) => row[column] === value);
    let rows;
    if (this.action === 'insert') {
      const row = { id: id(), created_at: new Date().toISOString(), ...this.payload };
      all.push(row);
      rows = [row];
    } else if (this.action === 'update') {
      rows = all.filter(matches);
      rows.forEach((row) => Object.assign(row, this.payload));
    } else if (this.action === 'delete') {
      rows = all.filter(matches);
      tables[this.table] = all.filter((row) => !matches(row));
    } else {
      rows = all.filter(matches);
      if (this.sort) {
        const { column, ascending } = this.sort;
        rows.sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (ascending ? 1 : -1));
      }
    }
    const copies = rows.map((row) => ({ ...row })); // callers get copies, like real query results
    return { data: this.one ? copies[0] ?? null : copies, error: null };
  }
  // Lets the query be awaited, like the real client.
  then(resolve, reject) {
    return Promise.resolve().then(() => this.run()).then(resolve, reject);
  }
}

export const supabase = {
  from: (table) => new Query(table),
};
