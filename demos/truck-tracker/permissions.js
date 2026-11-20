const PAINT_ADVANCE = new Set([5, 6, 7, 8, 9, 10, 11, 12]);
const PAINT_REVERSE = new Set([5, 6, 7, 8, 9, 10, 11, 12]);
const PAINT_PAUSE   = new Set([5, 6, 7, 8, 9, 10, 11, 12]);
const PROD_ADVANCE  = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const PROD_REVERSE  = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const PROD_PAUSE    = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

const FINAL_STEP = 12;

export const Perm = {
  canAddTruck: (r) => r === 'admin' || r === 'office',
  canStart: (r) => r === 'admin' || r === 'production',
  canAdvance: (r, s) =>
    r === 'admin' ||
    (r === 'paint' && PAINT_ADVANCE.has(s)) ||
    (r === 'production' && PROD_ADVANCE.has(s)),
  canReverse: (r, s) =>
    r === 'admin' ||
    (r === 'paint' && PAINT_REVERSE.has(s)) ||
    (r === 'production' && PROD_REVERSE.has(s)),
  canPause: (r, s) =>
    r === 'admin' ||
    (r === 'paint' && PAINT_PAUSE.has(s)) ||
    (r === 'production' && PROD_PAUSE.has(s)),
  canResume: (r, s) => Perm.canPause(r, s),
  canArchive: (r, s) =>
    r === 'admin' || (r === 'office' && s >= FINAL_STEP),
  canRemoveFromArchive: (r) => r === 'admin',
  canManageRecipients: (r) => r === 'admin',
  canEditEta: (r) => r === 'admin' || r === 'office' || r === 'production',
  canEditTruck: (r) => r === 'admin' || r === 'office',
  canSeeAnyControls: (r, s) =>
    Perm.canAdvance(r, s) ||
    Perm.canReverse(r, s) ||
    Perm.canPause(r, s) ||
    Perm.canArchive(r, s) ||
    Perm.canEditEta(r) ||
    Perm.canEditTruck(r),
};
