// Every project on the site lives here. Adding a project = adding one object.
// faceColor picks the cube face: red, orange, yellow, green, blue or pink.
// Faces with no project say "Coming soon".
//
// DRAFT: only the titles are real. Every other line is a placeholder for Brendon to write.
// Nothing here may ever contain real Concord data.
const TO_WRITE = 'Brendon to write.';

export const projects = [
  {
    id: 'truck-tracker',
    title: 'Truck production tracker',
    faceColor: 'blue',
    summary: `One line on what this is. ${TO_WRITE}`,
    problem: `The problem, in one line. ${TO_WRITE}`,
    built: `What I built. ${TO_WRITE}`,
    role: `My role. ${TO_WRITE}`,
    tech: [],
    result: `The result. ${TO_WRITE}`,
    type: 'internal-prototype',
    prototype: null, // the fake-data demo module, once its screens are agreed
  },
  {
    id: 'inventory-barcode',
    title: 'Inventory + barcode system',
    faceColor: 'red',
    summary: `One line on what this is. ${TO_WRITE}`,
    problem: `The problem, in one line. ${TO_WRITE}`,
    built: `What I built. ${TO_WRITE}`,
    role: `My role. ${TO_WRITE}`,
    tech: [],
    result: `The result. ${TO_WRITE}`,
    type: 'internal-prototype',
    prototype: null,
  },
  {
    id: 'online-store',
    title: 'Concord online store',
    faceColor: 'yellow',
    summary: `One line on what this is. ${TO_WRITE}`,
    problem: `The problem, in one line. ${TO_WRITE}`,
    built: `What I built. ${TO_WRITE}`,
    role: `My role. ${TO_WRITE}`,
    tech: [],
    result: `The result. ${TO_WRITE}`,
    type: 'public-site', // live link or demo: still to be decided
    liveUrl: null,
  },
  {
    id: 'pre-owned-pumps',
    title: 'Concord pre-owned pumps store',
    faceColor: 'orange',
    summary: `One line on what this is. ${TO_WRITE}`,
    problem: `The problem, in one line. ${TO_WRITE}`,
    built: `What I built. ${TO_WRITE}`,
    role: `My role. ${TO_WRITE}`,
    tech: [],
    result: `The result. ${TO_WRITE}`,
    type: 'public-site',
    liveUrl: null,
  },
];

export const projectForFace = (faceColor) => projects.find((p) => p.faceColor === faceColor) ?? null;
export const projectById = (id) => projects.find((p) => p.id === id) ?? null;
