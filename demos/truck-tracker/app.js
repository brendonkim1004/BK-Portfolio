/**
 * Concord Concrete Pumps — Production Tracker (portfolio demo)
 *
 * This is the real tracker's front end. The only change is the data: instead of the company
 * database it uses made-up trucks kept in memory (see fakeData.js). Nothing is saved or sent.
 */

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './styles.css';
import { supabase, resetDemo } from './fakeData.js';
import { Perm } from './permissions.js';

// ============ Production Steps (names only; time is per-model total via getTotalDays) ============
// Demo: the longer step names are shortened to one or two words so the timeline reads cleanly.
const STEP_NAMES = [
  'Prep Chassis',
  'Prep Pump',
  'Mounting',
  'Welding',
  'Electrical Check',
  'First Testing',
  'Sandblasting',
  'Painting',
  'Final Assembly',
  'Final Electrical',
  'Final Testing',
  'Pre Delivery',
];
const TOTAL_STEPS = STEP_NAMES.length;
const DEFAULT_TOTAL_DAYS = 42;

// ============ Confetti (no deps; canvas-based burst) ============
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#22c55e', '#f97316', '#3b82f6', '#eab308', '#ec4899', '#ffffff'];
  const pieces = Array.from({ length: 160 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 120,
    y: canvas.height / 2 + (Math.random() - 0.5) * 60,
    vx: (Math.random() - 0.5) * 14,
    vy: Math.random() * -16 - 4,
    size: Math.random() * 6 + 4,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const DURATION = 2500;
  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.vy += 0.4;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (elapsed < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

// ============ Model → total days lookup ============
// Demo: the model names and build times here are invented, not the real ones.
function getTotalDays(model) {
  if (!model) return DEFAULT_TOTAL_DAYS;
  const m = String(model).trim().toUpperCase();
  if (m.startsWith('TR')) return 24; // trailer pumps
  if (m.startsWith('LP')) return 30; // line pumps
  const size = parseInt((m.match(/(\d{2,3})/) || [])[1], 10); // boom length in the model name
  if (size >= 50) return 60;
  if (size >= 45) return 52;
  return DEFAULT_TOTAL_DAYS;
}

// ============ DB ↔ App mapping ============
function dbToTruck(row) {
  if (!row) return null;
  return {
    id: row.id,
    model: row.model,
    truckNumber: row.truck_number || '',
    customer: row.customer || '',
    vin: row.vin,
    startDate: row.start_date,
    assignedTo: row.assigned_to || '',
    pumpArrival: row.pump_arrival || '',
    truckArrival: row.truck_arrival || '',
    currentStep: row.current_step,
    status: row.status,
    pauseReason: row.pause_reason,
    archive: row.archive,
    completionDate: row.completion_date,
    stepStartedAt: row.step_started_at,
    productionStartedAt: row.production_started_at,
    pausedAt: row.paused_at,
    pausedSecondsAccumulated: row.paused_seconds_accumulated || 0,
    createdAt: row.created_at,
    etaOverride: row.eta_override,
  };
}

// ============ ETA ============
function computeEta(truck) {
  if (truck.etaOverride) {
    const [y, m, d] = String(truck.etaOverride).split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  if (!truck.productionStartedAt) return null;
  const totalDays = getTotalDays(truck.model);
  const baselineFinishMs = new Date(truck.productionStartedAt).getTime() + totalDays * 86400000;
  const accumulatedPauseMs = (truck.pausedSecondsAccumulated || 0) * 1000;
  const currentPauseMs = truck.pausedAt ? Math.max(0, Date.now() - new Date(truck.pausedAt).getTime()) : 0;
  return new Date(baselineFinishMs + accumulatedPauseMs + currentPauseMs);
}

function formatEta(date) {
  if (!date) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ============ Step progress (count-based) ============
function getStepProgress(truck) {
  const current = Math.min(truck.currentStep || 1, TOTAL_STEPS);
  const fullCompleted = Math.max(0, current - 1);
  const pct = Math.round((fullCompleted / TOTAL_STEPS) * 100);
  return { current, total: TOTAL_STEPS, pct };
}

// ============ Auth ============
// Demo: everyone is signed in as an admin, so every button is available.
async function getSession() {
  return { id: 'demo-admin', username: 'demo', role: 'admin' };
}

// Demo: there is no login. "Reset demo" puts the made-up data back as it started.
async function logout() {
  resetDemo();
}

function currentRole() {
  return window.__concordRole;
}

// ============ Trucks (async, Supabase) ============
async function loadTrucks() {
  const { data, error } = await supabase.from('trucks').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(dbToTruck);
}

async function addTruck(model, truckNumber, vin, customer, pumpArrival, truckArrival) {
  if (!Perm.canAddTruck(currentRole())) throw new Error('Not permitted to add trucks.');
  const { data, error } = await supabase.from('trucks').insert({
    model,
    truck_number: truckNumber,
    vin,
    customer,
    pump_arrival: pumpArrival || '',
    truck_arrival: truckArrival || '',
    current_step: 1,
    status: 'pending',
    pause_reason: null,
    archive: false,
    completion_date: null,
    step_started_at: null,
    production_started_at: null,
    paused_at: null,
    paused_seconds_accumulated: 0,
  }).select().single();
  if (error) throw error;
  notifyTruckEvent(data.id, 'truck_pending');
  return dbToTruck(data);
}

async function updateTruck(id, fields) {
  if (!Perm.canEditTruck(currentRole())) throw new Error('Not permitted to edit trucks.');
  const { error } = await supabase.from('trucks').update({
    model: fields.model,
    truck_number: fields.truckNumber,
    vin: fields.vin,
    customer: fields.customer,
    pump_arrival: fields.pumpArrival || '',
    truck_arrival: fields.truckArrival || '',
  }).eq('id', id);
  if (error) throw error;
}

// The real app texts the office and managers here. The demo sends nothing.
async function notifyTruckEvent() {}

async function startTruck(id) {
  if (!Perm.canStart(currentRole())) throw new Error('Not permitted to start trucks.');
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const { error } = await supabase.from('trucks').update({
    status: 'in_progress',
    start_date: today,
    production_started_at: nowIso,
    step_started_at: nowIso,
    current_step: 1,
  }).eq('id', id);
  if (error) throw error;
  notifyTruckEvent(id, 'production_started');
}

async function advanceTruck(id) {
  const { data: rows } = await supabase.from('trucks').select('*').eq('id', id);
  const row = rows?.[0];
  if (!row) return;
  if (!Perm.canAdvance(currentRole(), row.current_step)) throw new Error('Not permitted to advance this step.');
  const updates = {};
  let finishedEvent = null;
  if (row.current_step >= TOTAL_STEPS) {
    updates.status = 'completed';
    updates.archive = true;
    updates.completion_date = new Date().toISOString().slice(0, 10);
    finishedEvent = 'truck_finished';
  } else {
    updates.current_step = row.current_step + 1;
    updates.status = 'in_progress';
    updates.pause_reason = null;
    updates.step_started_at = new Date().toISOString();
    if (row.current_step === 6) finishedEvent = 'step_6_completed';
    else if (row.current_step === 8) finishedEvent = 'step_8_completed';
    else if (row.current_step === 11) finishedEvent = 'step_11_completed';
  }
  await supabase.from('trucks').update(updates).eq('id', id);
  if (finishedEvent) notifyTruckEvent(id, finishedEvent);
}

async function reverseTruck(id) {
  const { data: rows } = await supabase.from('trucks').select('*').eq('id', id);
  const row = rows?.[0];
  if (!row || row.current_step <= 1) return;
  if (!Perm.canReverse(currentRole(), row.current_step)) throw new Error('Not permitted to reverse this step.');
  await supabase.from('trucks').update({
    current_step: row.current_step - 1,
    status: 'in_progress',
    pause_reason: null,
    step_started_at: new Date().toISOString(),
  }).eq('id', id);
}

async function pauseTruck(id, reason) {
  const { data: rows } = await supabase.from('trucks').select('current_step,paused_at').eq('id', id);
  const row = rows?.[0];
  if (!row) return;
  if (!Perm.canPause(currentRole(), row.current_step)) throw new Error('Not permitted to pause this step.');
  await supabase.from('trucks').update({
    status: 'paused',
    pause_reason: reason || 'Unknown',
    paused_at: row.paused_at || new Date().toISOString(),
  }).eq('id', id);
  notifyTruckEvent(id, 'hold_started');
}

async function resumeTruck(id) {
  const { data: rows } = await supabase.from('trucks').select('current_step,paused_at,paused_seconds_accumulated').eq('id', id);
  const row = rows?.[0];
  if (!row) return;
  if (!Perm.canResume(currentRole(), row.current_step)) throw new Error('Not permitted to resume this step.');
  let accumulated = row.paused_seconds_accumulated || 0;
  if (row.paused_at) {
    const elapsedSec = Math.floor((Date.now() - new Date(row.paused_at).getTime()) / 1000);
    accumulated += Math.max(0, elapsedSec);
  }
  await supabase.from('trucks').update({
    status: 'in_progress',
    pause_reason: null,
    paused_at: null,
    paused_seconds_accumulated: accumulated,
  }).eq('id', id);
  notifyTruckEvent(id, 'hold_ended');
}

async function removeFromArchive(id) {
  if (!Perm.canRemoveFromArchive(currentRole())) throw new Error('Not permitted to remove from archive.');
  const { data: rows } = await supabase.from('trucks').select('current_step,production_started_at').eq('id', id);
  const row = rows?.[0];
  if (!row) return;
  const restoredStatus = row.production_started_at ? 'in_progress' : 'pending';
  await supabase.from('trucks').update({
    archive: false,
    status: restoredStatus,
    completion_date: null,
  }).eq('id', id);
}

async function moveToArchive(id) {
  const { data: rows } = await supabase.from('trucks').select('current_step').eq('id', id);
  const row = rows?.[0];
  if (!row) return;
  if (!Perm.canArchive(currentRole(), row.current_step)) throw new Error('Not permitted to archive this truck.');
  await supabase.from('trucks').update({
    archive: true,
    status: 'completed',
    completion_date: new Date().toISOString().slice(0, 10),
  }).eq('id', id);
  notifyTruckEvent(id, 'truck_finished');
}

// ============ Notification Recipients ============
async function loadRecipients() {
  const { data, error } = await supabase
    .from('notification_recipients')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function addRecipient({ name, phone, groups, active }) {
  if (!Perm.canManageRecipients(currentRole())) throw new Error('Not permitted.');
  if (!groups || groups.length === 0) throw new Error('Select at least one group.');
  if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) throw new Error('Phone must be E.164 (e.g. +14165551234).');
  const { error } = await supabase.from('notification_recipients').insert({
    name, phone, groups, active: !!active,
  });
  if (error) throw error;
}

async function setRecipientActive(id, active) {
  if (!Perm.canManageRecipients(currentRole())) throw new Error('Not permitted.');
  const { error } = await supabase.from('notification_recipients')
    .update({ active }).eq('id', id);
  if (error) throw error;
}

async function deleteRecipient(id) {
  if (!Perm.canManageRecipients(currentRole())) throw new Error('Not permitted.');
  const { error } = await supabase.from('notification_recipients').delete().eq('id', id);
  if (error) throw error;
}

function renderRecipients(recipients) {
  const tbody = document.getElementById('recipients-tbody');
  const empty = document.getElementById('recipients-empty');
  if (!tbody || !empty) return;
  if (recipients.length === 0) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  tbody.innerHTML = recipients.map(r => `
    <tr data-id="${escapeHtml(r.id)}">
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.phone)}</td>
      <td>${escapeHtml((r.groups || []).join(', '))}</td>
      <td>
        <label>
          <input type="checkbox" class="recipient-active-toggle"
                 ${r.active ? 'checked' : ''} />
        </label>
      </td>
      <td><button type="button" class="recipient-delete-btn">Delete</button></td>
    </tr>
  `).join('');
}

// ============ UI State ============
let currentTrucks = [];
let pendingTrucks = [];
let selectedTruckId = null;

function getActiveTrucks(trucks) {
  return trucks
    .filter(t => !t.archive && t.status !== 'pending')
    .sort((a, b) => {
      const aHold = a.status === 'paused' ? 1 : 0;
      const bHold = b.status === 'paused' ? 1 : 0;
      if (aHold !== bHold) return aHold - bHold;
      const stepDiff = (b.currentStep || 0) - (a.currentStep || 0);
      if (stepDiff !== 0) return stepDiff;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated;
    });
}

function getPendingTrucks(trucks) {
  const isTbd = (t) => String(t.customer || '').trim().toUpperCase() === 'TBD';
  return trucks
    .filter(t => !t.archive && t.status === 'pending')
    .sort((a, b) => {
      const aTbd = isTbd(a), bTbd = isTbd(b);
      if (aTbd !== bTbd) return aTbd ? 1 : -1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
}

function getArchivedTrucks(trucks) {
  return trucks.filter(t => t.archive);
}

// ============ Render ============
function applyRoleVisibility(role) {
  const manageRecipientsBtn = document.getElementById('manage-recipients-btn');
  if (manageRecipientsBtn) {
    manageRecipientsBtn.hidden = !Perm.canManageRecipients(role);
  }
}

function renderDashboard(trucks) {
  currentTrucks = getActiveTrucks(trucks);
  pendingTrucks = getPendingTrucks(trucks);
  renderTruckCards(trucks);
  renderPendingCards(trucks);
  renderArchive(trucks);
  applyRoleVisibility(currentRole());
}

function renderTruckCards(trucks) {
  const container = document.getElementById('truck-cards');
  if (!container) return;
  const role = currentRole();
  container.innerHTML = '';

  currentTrucks.forEach(truck => {
    const { pct } = getStepProgress(truck);
    const stepName = STEP_NAMES[truck.currentStep - 1] || 'Unknown';
    const eta = computeEta(truck);
    const card = document.createElement('div');
    card.className = 'truck-card';
    card.dataset.id = truck.id;
    card.innerHTML = `
      <div class="truck-card-header">
        <div>
          <div class="truck-card-model">${escapeHtml(truck.model)}${truck.status === 'paused' && truck.pauseReason ? ` <span class="hold-reason-inline">- ${escapeHtml(truck.pauseReason)}</span>` : ''}</div>
          <div class="truck-card-model">Customer: ${escapeHtml(truck.customer || '—')}</div>
          <div class="truck-card-vin">Truck: ${escapeHtml(truck.truckNumber || '—')}</div>
          <div class="truck-card-vin">VIN: ${escapeHtml(truck.vin)}</div>
        </div>
        <span class="status-badge ${truck.status === 'paused' ? 'paused' : 'in-progress'}">
          ${truck.status === 'paused' ? 'On Hold' : 'In Progress'}
        </span>
      </div>
      <div class="truck-card-step">Step ${truck.currentStep}: ${escapeHtml(stepName)}</div>
      <div class="truck-card-progress">
        <div class="progress-bar">
          <div class="progress-fill ${truck.status === 'paused' ? 'paused' : ''}" style="width: ${pct}%"></div>
        </div>
        <div class="progress-text">${pct}% complete</div>
      </div>
      <div class="truck-card-eta">Completion Date: ${escapeHtml(formatEta(eta))}</div>
    `;
    card.addEventListener('click', () => openTruckPopup(truck.id, trucks));
    container.appendChild(card);
  });

  const addBtn = document.getElementById('add-truck-btn');
  if (addBtn) addBtn.style.display = Perm.canAddTruck(role) ? 'inline-flex' : 'none';
}

function renderPendingCards(trucks) {
  const container = document.getElementById('pending-cards');
  if (!container) return;
  const role = currentRole();
  container.innerHTML = '';

  if (pendingTrucks.length === 0) {
    container.innerHTML = '<div class="empty-state">No pending trucks.</div>';
    return;
  }

  pendingTrucks.forEach(truck => {
    const card = document.createElement('div');
    card.className = 'truck-card pending';
    card.dataset.id = truck.id;
    const startBtnHtml = Perm.canStart(role)
      ? `<button class="btn btn-primary pending-start-btn" data-id="${escapeHtml(truck.id)}">Start</button>`
      : '';
    const editBtnHtml = Perm.canEditTruck(role)
      ? `<button class="btn btn-secondary pending-edit-btn" data-id="${escapeHtml(truck.id)}">Edit</button>`
      : '';
    card.innerHTML = `
      <div class="truck-card-header">
        <div>
          <div class="truck-card-model">${escapeHtml(truck.model)}${truck.pumpArrival ? ' - ' + escapeHtml(truck.pumpArrival) : ''}</div>
          <div class="truck-card-model">Customer: ${escapeHtml(truck.customer || '—')}</div>
          <div class="truck-card-vin">Truck: ${escapeHtml(truck.truckNumber || '—')}${truck.truckArrival ? ' - ' + escapeHtml(truck.truckArrival) : ''}</div>
          <div class="truck-card-vin">VIN: ${escapeHtml(truck.vin)}</div>
        </div>
        <span class="status-badge pending">Pending</span>
      </div>
      ${startBtnHtml}${editBtnHtml}
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('.pending-start-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      btn.disabled = true;
      try {
        await startTruck(id);
        const fresh = await loadTrucks();
        renderDashboard(fresh);
      } catch (err) {
        alert(err.message || 'Failed to start truck');
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll('.pending-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const truck = pendingTrucks.find(t => t.id === id);
      if (truck) openEditTruckModal(truck);
    });
  });
}

function renderArchive(trucks) {
  const archived = getArchivedTrucks(trucks);
  const countEl = document.getElementById('archive-count');
  const tbody = document.getElementById('archive-body');
  if (!countEl || !tbody) return;
  countEl.textContent = `(${archived.length})`;
  tbody.innerHTML = '';

  const role = currentRole();
  const canEdit = Perm.canRemoveFromArchive(role);

  archived.forEach(t => {
    const start = t.startDate ? new Date(t.startDate) : null;
    const end = t.completionDate ? new Date(t.completionDate) : null;
    const totalDays = start && end ? Math.round((end - start) / (1000 * 60 * 60 * 24)) : '-';
    const actionCell = canEdit
      ? `<td><button class="archive-edit-btn archive-remove-btn" data-id="${escapeHtml(t.id)}">Remove</button></td>`
      : '<td></td>';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(t.model)}</td>
      <td>${escapeHtml(t.truckNumber || '-')}</td>
      <td>${escapeHtml(t.vin)}</td>
      <td>${escapeHtml(t.customer || '-')}</td>
      <td>${escapeHtml(t.startDate || '-')}</td>
      <td>${escapeHtml(t.completionDate || '-')}</td>
      <td>${totalDays}</td>
      ${actionCell}
    `;
    tbody.appendChild(tr);
  });

  if (canEdit) {
    tbody.querySelectorAll('.archive-remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (!confirm('Remove this truck from the archive and restore it to production?')) return;
        btn.disabled = true;
        try {
          await removeFromArchive(id);
          const fresh = await loadTrucks();
          renderDashboard(fresh);
        } catch (err) {
          alert(err.message || 'Failed to remove from archive');
          btn.disabled = false;
        }
      });
    });
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

// ============ Truck Popup ============
async function openTruckPopup(id, trucks) {
  selectedTruckId = id;
  const trucksList = trucks || await loadTrucks();
  const truck = trucksList.find(t => t.id === id);
  if (!truck) return;

  const currentStepName = STEP_NAMES[truck.currentStep - 1] || 'Unknown';
  const currentStepFraction = 0; // step-count progress only; per-step time is removed

  document.getElementById('popup-model').textContent = truck.model;
  document.getElementById('popup-vin').textContent = `VIN: ${truck.vin}`;

  const pausedBanner = document.getElementById('popup-paused-banner');
  const pauseReasonEl = document.getElementById('popup-pause-reason');
  if (truck.status === 'paused' && truck.pauseReason) {
    pausedBanner.classList.remove('hidden');
    pauseReasonEl.textContent = truck.pauseReason;
  } else {
    pausedBanner.classList.add('hidden');
  }

  const stepsContainer = document.getElementById('popup-steps');
  stepsContainer.innerHTML = '';
  STEP_NAMES.forEach((name, i) => {
    const el = document.createElement('div');
    const num = i + 1;
    let cls = 'remaining';
    let fillPct = 0;
    if (num < truck.currentStep) {
      cls = 'completed';
      fillPct = 100;
    } else if (num === truck.currentStep) {
      cls = 'current';
      fillPct = Math.round(currentStepFraction * 100);
    }
    el.className = `timeline-step ${cls}`;
    el.title = name;
    if (cls === 'current') {
      el.innerHTML = `
        <span class="timeline-step-label">${num}. ${escapeHtml(name)}</span>
        <div class="timeline-step-progress-bar">
          <div class="timeline-step-progress-fill" style="width: ${fillPct}%"></div>
        </div>
      `;
    } else {
      el.innerHTML = `${num}. ${escapeHtml(name)}`;
    }
    stepsContainer.appendChild(el);
  });

  document.getElementById('popup-current-step').textContent = `Step ${truck.currentStep}: ${currentStepName}`;
  const truckNumEl = document.getElementById('popup-truck-number');
  if (truckNumEl) truckNumEl.textContent = truck.truckNumber || '—';
  const customerEl = document.getElementById('popup-customer');
  if (customerEl) customerEl.textContent = truck.customer || '—';
  const etaEl = document.getElementById('popup-eta');
  if (etaEl) etaEl.textContent = formatEta(computeEta(truck));

  const role = currentRole();
  const step = truck.currentStep;
  const paused = truck.status === 'paused';

  const adminControls = document.getElementById('popup-admin-controls');
  adminControls.classList.toggle('hidden', !Perm.canSeeAnyControls(role, step));

  const backBtn = document.getElementById('popup-back-btn');
  const advanceBtn = document.getElementById('popup-advance-btn');
  const resumeBtn = document.getElementById('popup-resume-btn');
  const pauseBtn = document.getElementById('popup-pause-btn');
  const pauseControl = pauseBtn ? pauseBtn.closest('.pause-control') : null;
  const archiveBtn = document.getElementById('popup-archive-btn');

  const canAdvance = Perm.canAdvance(role, step);
  const canReverse = Perm.canReverse(role, step);
  const canPause = Perm.canPause(role, step);
  const canResume = Perm.canResume(role, step);
  const canArchive = Perm.canArchive(role, step);

  if (backBtn) {
    backBtn.classList.toggle('hidden', !canReverse);
    backBtn.disabled = step <= 1;
  }
  if (advanceBtn) {
    advanceBtn.classList.toggle('hidden', paused || !canAdvance);
    advanceBtn.disabled = false;
    advanceBtn.textContent = (step === TOTAL_STEPS) ? 'Finish Truck' : 'Advance to Next Step';
  }
  if (resumeBtn) {
    resumeBtn.classList.toggle('hidden', !paused || !canResume);
  }
  if (pauseControl) {
    pauseControl.classList.toggle('hidden', paused || !canPause);
  }
  if (archiveBtn) {
    archiveBtn.classList.toggle('hidden', !canArchive);
    // Admins can archive at any step; non-admins (e.g. office) only at the final step.
    archiveBtn.disabled = role !== 'admin' && step < TOTAL_STEPS;
  }
  const editEtaBtn = document.getElementById('popup-edit-eta-btn');
  if (editEtaBtn) {
    editEtaBtn.classList.toggle('hidden', !Perm.canEditEta(role));
  }
  const editTruckBtn = document.getElementById('popup-edit-truck-btn');
  if (editTruckBtn) {
    editTruckBtn.classList.toggle('hidden', !Perm.canEditTruck(role));
  }

  document.getElementById('popup-pause-reason-select').value = '';
  document.getElementById('popup-other-reason').value = '';
  document.getElementById('popup-other-reason-wrap').classList.add('hidden');

  document.getElementById('truck-popup').classList.add('active');
  document.getElementById('truck-popup').setAttribute('aria-hidden', 'false');
}

async function closeTruckPopup() {
  document.getElementById('truck-popup').classList.remove('active');
  document.getElementById('truck-popup').setAttribute('aria-hidden', 'true');
  selectedTruckId = null;
  const trucks = await loadTrucks();
  renderDashboard(trucks);
}

// ============ Add Truck Modal ============
function openAddTruckModal() {
  const form = document.getElementById('add-truck-form');
  form.reset();
  document.getElementById('add-truck-modal').classList.add('active');
  document.getElementById('add-truck-modal').setAttribute('aria-hidden', 'false');
}

function closeAddTruckModal() {
  document.getElementById('add-truck-modal').classList.remove('active');
  document.getElementById('add-truck-modal').setAttribute('aria-hidden', 'true');
}

// ============ Edit Truck Modal ============
function openEditTruckModal(truck) {
  if (!truck) return;
  document.getElementById('edit-truck-id').value = truck.id;
  document.getElementById('edit-model').value = truck.model || '';
  document.getElementById('edit-truck-number').value = truck.truckNumber || '';
  document.getElementById('edit-vin').value = truck.vin || '';
  document.getElementById('edit-customer').value = truck.customer || '';
  document.getElementById('edit-pump-arrival').value = truck.pumpArrival || '';
  document.getElementById('edit-truck-arrival').value = truck.truckArrival || '';
  const modal = document.getElementById('edit-truck-modal');
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeEditTruckModal() {
  const modal = document.getElementById('edit-truck-modal');
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

// ============ Archive Toggle ============
function toggleArchive() {
  const content = document.getElementById('archive-content');
  const btn = document.getElementById('archive-toggle');
  const expanded = content.classList.toggle('hidden');
  btn.setAttribute('aria-expanded', String(!expanded));
}

// ============ Event Handlers ============
function attachDashboardHandlers() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
      window.location.reload();
    });
  }

  const addTruckBtn = document.getElementById('add-truck-btn');
  if (addTruckBtn) addTruckBtn.addEventListener('click', openAddTruckModal);

  const addTruckForm = document.getElementById('add-truck-form');
  if (addTruckForm) {
    addTruckForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const model = document.getElementById('add-model').value.trim();
        const truckNumber = document.getElementById('add-truck-number').value.trim();
        const vin = document.getElementById('add-vin').value.trim();
        const customer = document.getElementById('add-customer').value.trim();
        const pumpArrival = document.getElementById('add-pump-arrival').value.trim();
        const truckArrival = document.getElementById('add-truck-arrival').value.trim();
        if (!model || !truckNumber || !vin || !customer) {
          alert('Model, Truck, VIN, and Customer are all required.');
          return;
        }
        await addTruck(model, truckNumber, vin, customer, pumpArrival, truckArrival);
        closeAddTruckModal();
        const trucks = await loadTrucks();
        renderDashboard(trucks);
      } catch (err) {
        alert(err.message || 'Failed to add truck');
      }
    });
  }

  const addTruckClose = document.getElementById('add-truck-close');
  const addTruckCancel = document.getElementById('add-truck-cancel');
  if (addTruckClose) addTruckClose.addEventListener('click', closeAddTruckModal);
  if (addTruckCancel) addTruckCancel.addEventListener('click', closeAddTruckModal);

  const editTruckForm = document.getElementById('edit-truck-form');
  if (editTruckForm) {
    editTruckForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('edit-truck-id').value;
        const model = document.getElementById('edit-model').value.trim();
        const truckNumber = document.getElementById('edit-truck-number').value.trim();
        const vin = document.getElementById('edit-vin').value.trim();
        const customer = document.getElementById('edit-customer').value.trim();
        const pumpArrival = document.getElementById('edit-pump-arrival').value.trim();
        const truckArrival = document.getElementById('edit-truck-arrival').value.trim();
        if (!id || !model || !truckNumber || !vin || !customer) {
          alert('Model, Truck, VIN, and Customer are all required.');
          return;
        }
        await updateTruck(id, { model, truckNumber, vin, customer, pumpArrival, truckArrival });
        closeEditTruckModal();
        const trucks = await loadTrucks();
        renderDashboard(trucks);
        if (selectedTruckId === id) {
          openTruckPopup(id, trucks);
        }
      } catch (err) {
        alert(err.message || 'Failed to update truck');
      }
    });
  }

  const editTruckClose = document.getElementById('edit-truck-close');
  const editTruckCancel = document.getElementById('edit-truck-cancel');
  if (editTruckClose) editTruckClose.addEventListener('click', closeEditTruckModal);
  if (editTruckCancel) editTruckCancel.addEventListener('click', closeEditTruckModal);

  const popupEditTruckBtn = document.getElementById('popup-edit-truck-btn');
  if (popupEditTruckBtn) {
    popupEditTruckBtn.addEventListener('click', async () => {
      if (!selectedTruckId) return;
      const trucks = await loadTrucks();
      const truck = trucks.find(t => t.id === selectedTruckId);
      if (truck) openEditTruckModal(truck);
    });
  }

  const popupClose = document.getElementById('popup-close');
  if (popupClose) popupClose.addEventListener('click', closeTruckPopup);

  const popupResumeBtn = document.getElementById('popup-resume-btn');
  if (popupResumeBtn) {
    popupResumeBtn.addEventListener('click', async () => {
      if (!selectedTruckId) return;
      await resumeTruck(selectedTruckId);
      const trucks = await loadTrucks();
      openTruckPopup(selectedTruckId, trucks);
    });
  }

  const popupBackBtn = document.getElementById('popup-back-btn');
  if (popupBackBtn) {
    popupBackBtn.addEventListener('click', async () => {
      if (!selectedTruckId) return;
      await reverseTruck(selectedTruckId);
      const trucks = await loadTrucks();
      openTruckPopup(selectedTruckId, trucks);
    });
  }

  const popupAdvanceBtn = document.getElementById('popup-advance-btn');
  if (popupAdvanceBtn) {
    popupAdvanceBtn.addEventListener('click', async () => {
      if (!selectedTruckId) return;
      const isFinish = popupAdvanceBtn.textContent.trim() === 'Finish Truck';
      await advanceTruck(selectedTruckId);
      if (isFinish) launchConfetti();
      const trucks = await loadTrucks();
      const t = trucks.find(x => x.id === selectedTruckId);
      if (t?.archive) {
        await closeTruckPopup();
      } else {
        openTruckPopup(selectedTruckId, trucks);
      }
    });
  }

  const popupPauseBtn = document.getElementById('popup-pause-btn');
  if (popupPauseBtn) {
    popupPauseBtn.addEventListener('click', async () => {
      if (!selectedTruckId) return;
      const select = document.getElementById('popup-pause-reason-select');
      let reason = select ? select.value : '';
      if (reason === 'other') {
        const other = document.getElementById('popup-other-reason');
        reason = other ? other.value.trim() || 'Other' : 'Other';
      }
      if (!reason) {
        alert('Please select a hold reason.');
        return;
      }
      await pauseTruck(selectedTruckId, reason);
      const trucks = await loadTrucks();
      openTruckPopup(selectedTruckId, trucks);
    });
  }

  const pauseReasonSelect = document.getElementById('popup-pause-reason-select');
  if (pauseReasonSelect) {
    pauseReasonSelect.addEventListener('change', () => {
      const wrap = document.getElementById('popup-other-reason-wrap');
      wrap.classList.toggle('hidden', pauseReasonSelect.value !== 'other');
    });
  }

  const popupArchiveBtn = document.getElementById('popup-archive-btn');
  if (popupArchiveBtn) {
    popupArchiveBtn.addEventListener('click', async () => {
      if (!selectedTruckId) return;
      await moveToArchive(selectedTruckId);
      closeTruckPopup();
    });
  }

  const popupEditEtaBtn = document.getElementById('popup-edit-eta-btn');
  if (popupEditEtaBtn) {
    popupEditEtaBtn.addEventListener('click', async () => {
      if (!selectedTruckId) return;
      const trucks = await loadTrucks();
      const truck = trucks.find(t => t.id === selectedTruckId);
      if (!truck) return;
      const currentIso = truck.etaOverride
        ? String(truck.etaOverride).slice(0, 10)
        : (computeEta(truck) ? computeEta(truck).toISOString().slice(0, 10) : '');
      const input = window.prompt(
        'Set Completion Date (YYYY-MM-DD). Leave blank to clear the override and use the computed date.',
        currentIso,
      );
      if (input === null) return;
      const trimmed = input.trim();
      let value = null;
      if (trimmed) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          alert('Invalid date. Please use YYYY-MM-DD format.');
          return;
        }
        value = trimmed;
      }
      const { error } = await supabase
        .from('trucks')
        .update({ eta_override: value })
        .eq('id', selectedTruckId);
      if (error) {
        alert(`Failed to update Completion Date: ${error.message}`);
        return;
      }
      const updated = await loadTrucks();
      renderDashboard(updated);
      openTruckPopup(selectedTruckId, updated);
    });
  }

  const archiveToggle = document.getElementById('archive-toggle');
  if (archiveToggle) archiveToggle.addEventListener('click', toggleArchive);

  const manageBtn = document.getElementById('manage-recipients-btn');
  const recipientsSection = document.getElementById('recipients-section');
  if (manageBtn) {
    manageBtn.addEventListener('click', async () => {
      if (!recipientsSection) return;
      const opening = recipientsSection.hidden;
      recipientsSection.hidden = !opening;
      if (opening) {
        try {
          renderRecipients(await loadRecipients());
        } catch (e) {
          alert(`Could not load recipients: ${e.message}`);
        }
      }
    });
  }

  const addRecipientForm = document.getElementById('add-recipient-form');
  if (addRecipientForm) {
    addRecipientForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(addRecipientForm);
      const groups = fd.getAll('groups');
      try {
        await addRecipient({
          name: String(fd.get('name') || '').trim(),
          phone: String(fd.get('phone') || '').trim(),
          groups,
          active: fd.get('active') !== null,
        });
        addRecipientForm.reset();
        renderRecipients(await loadRecipients());
      } catch (e) {
        alert(`Could not add recipient: ${e.message}`);
      }
    });
  }

  const recipientsTbody = document.getElementById('recipients-tbody');
  if (recipientsTbody) {
    recipientsTbody.addEventListener('click', async (ev) => {
      const row = ev.target.closest('tr[data-id]');
      if (!row) return;
      const id = row.getAttribute('data-id');
      if (ev.target.classList.contains('recipient-delete-btn')) {
        if (!confirm('Delete this recipient?')) return;
        try {
          await deleteRecipient(id);
          renderRecipients(await loadRecipients());
        } catch (e) {
          alert(`Could not delete: ${e.message}`);
        }
      }
    });
    recipientsTbody.addEventListener('change', async (ev) => {
      const row = ev.target.closest('tr[data-id]');
      if (!row) return;
      const id = row.getAttribute('data-id');
      if (ev.target.classList.contains('recipient-active-toggle')) {
        try {
          await setRecipientActive(id, ev.target.checked);
        } catch (e) {
          alert(`Could not update: ${e.message}`);
          ev.target.checked = !ev.target.checked;
        }
      }
    });
  }

  const truckPopup = document.getElementById('truck-popup');
  if (truckPopup) {
    truckPopup.addEventListener('click', (e) => {
      if (e.target.id === 'truck-popup') closeTruckPopup();
    });
  }

  const addTruckModal = document.getElementById('add-truck-modal');
  if (addTruckModal) {
    addTruckModal.addEventListener('click', (e) => {
      if (e.target.id === 'add-truck-modal') closeAddTruckModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.getElementById('truck-popup')?.classList.contains('active')) closeTruckPopup();
      else if (document.getElementById('add-truck-modal')?.classList.contains('active')) closeAddTruckModal();
    }
  });
}

// ============ Init ============
export async function initDashboard() {
  attachDashboardHandlers();

  let session;
  try {
    session = await getSession();
  } catch (err) {
    console.error('Auth error:', err);
    window.location.reload();
    return;
  }
  if (!session) {
    window.location.reload();
    return;
  }
  window.__concordRole = session.role;
  const roleBadge = document.getElementById('role-badge');
  if (roleBadge) {
    roleBadge.textContent = `Role: ${session.role}`;
  }
  applyRoleVisibility(session.role);
  try {
    const trucks = await loadTrucks();
    renderDashboard(trucks);
    // Periodic re-render so ETA shifts forward in real time while paused.
    setInterval(async () => {
      try {
        const t = await loadTrucks();
        if (!document.getElementById('truck-popup')?.classList.contains('active')) {
          renderDashboard(t);
        }
      } catch {}
    }, 30000);
  } catch (err) {
    console.error('Load trucks error:', err);
    alert(err.message || 'Failed to load trucks');
  }
}


// Start the page.
initDashboard();
