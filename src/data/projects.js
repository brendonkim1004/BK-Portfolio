// Every project on the site lives here. Adding a project = adding one object.
// faceColor picks the cube face: white, red, blue, green, orange or yellow.
// White (top), red and blue are the three showing when the cube arrives.
// Faces with no project say "Coming soon".
//
// links (optional): buttons shown at the bottom of the project page, for example
//   links: [{ label: 'Read the case study', url: 'https://...' }],
// The truck tracker and inventory system have none: their code stays private.
// liveUrl (the two stores): the real site is shown inside the project page's window, with a
// "Visit the full site" link under it.
//
// The wording is Brendon's own.
// Nothing here may ever contain real Concord data.

export const projects = [
  {
    id: "truck-tracker",
    title: "Truck Production Tracker",
    preview: "board",
    faceColor: "blue",
    summary: `An internal web app that shows where every concrete pump truck is in the build process.`,
    problem: `Production progress was hard to see at a glance, and people had to ask around to learn a truck's status.`,
    built: `A tracking site where each truck has its own card with its build plan and a step-by-step progress view. It sends automatic SMS alerts to a designated person when a new truck is created, when a truck passes a production step, and when a truck is finished.`,
    role: `Solo Developer and Designer`,
    tech: ["JavaScript", "Supabase", "Twilio", "Vercel"],
    result: `The team can check any truck's status at any time, and the right person is notified.`,
    type: "internal-prototype",
    prototype: "/demos/truck-tracker/dashboard.html",
  },
  {
    id: "inventory-barcode",
    title: "Inventory + Barcode System",
    preview: "barcode",
    faceColor: "red",
    summary: `A perpetual inventory system that uses barcode scanning to keep stock counts current.`,
    problem: `Inventory was counted only once a year, meaning no one knew what was in or out of stock.`,
    built: `A barcode workflow with fixed location barcodes. Scanning a bin's barcode removes one unit from stock, so counts stay current and no one has to do a manual count. The back end uses Supabase.`,
    role: `Solo Developer and Designer`,
    tech: ["Next.js", "React", "TypeScript", "Supabase", "Vercel"],
    result: `Stock can be tracked across inventory items without manual counting. Over 3,000 items counted in the system.`,
    type: "internal-prototype",
    prototype: "/demos/inventory/scan/index.html",
  },
  {
    id: "online-store",
    title: "Concord Online Store",
    preview: "shop",
    faceColor: "white",
    summary: `A public parts store for Concord Concrete Pumps, with categories, accounts and checkout.`,
    problem: `Customers had no way to browse and buy parts online, so every sale went through manual contact.`,
    built: `A modern storefront to help customers buy their desired product. It has category browsing, customer accounts, an admin dashboard for managing orders, and shipping and tax calculation at checkout.`,
    role: `Solo Developer and Designer`,
    tech: ["JavaScript", "HTML/CSS", "Supabase", "Stripe", "Resend", "Vercel"],
    result: `A working store that is used to sell real products.`,
    type: "public-site",
    liveUrl: "https://shop.concordpumps.com/",
  },
  {
    id: "pre-owned-pumps",
    title: "Concord Pre-Owned Pumps Store",
    preview: "listing",
    faceColor: "orange",
    summary: `A listing site for Concord's used concrete pumps.`,
    problem: `The old preowned pumps site was made decades ago and had many bugs and glitches.`,
    built: `Redesigned the entire site and made it customer friendly with a back end using Supabase.`,
    role: `Solo Developer and Designer`,
    tech: ["JavaScript", "HTML/CSS", "Supabase", "Resend", "Vercel"],
    result: `Increased sales by 250% and made site useable on all devices with no bugs`,
    type: "public-site",
    liveUrl: "https://www.preownedconcretepumps.com/",
  },
];

export const projectForFace = (faceColor) => projects.find((p) => p.faceColor === faceColor) ?? null;
export const projectById = (id) => projects.find((p) => p.id === id) ?? null;
