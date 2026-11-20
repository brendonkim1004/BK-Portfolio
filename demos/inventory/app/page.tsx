import Link from "next/link";
import { pageTitle } from "@/components/admin/formStyles";

// Ordered the way a day runs: the floor scans, the office watches and receives,
// and the catalogue work sits at the end (behind a sign-in in the real app).
const SURFACES = [
  {
    href: "/scan",
    title: "Scan out",
    body: "Log a part as used with one barcode scan. In this demo, click a sample label instead of using a handheld scanner.",
  },
  {
    href: "/stock",
    title: "Live stock",
    body: "What is on the shelf right now, per part. Searchable, sortable, and live as scans land.",
  },
  {
    href: "/projects",
    title: "Projects",
    body: "Give a job its own barcode, then scan parts against it and review what it consumed.",
  },
  {
    href: "/restock",
    title: "Restock",
    body: "A barcode that flips the scanner into add mode for putting received stock away.",
  },
  {
    href: "/test-item",
    title: "Test item",
    body: "A throwaway part for checking a scanner works without touching real inventory.",
  },
  {
    href: "/admin",
    title: "Admin",
    body: "Correct counts, and add or edit the parts and bins in the catalog. Signed in for you in this demo.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="max-w-xl">
        <h1 className={pageTitle}>Concord Concrete Pumps</h1>
        <p className="mt-1.5 text-lg font-semibold text-steel-600 dark:text-steel-400">
          Parts inventory
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-steel-600 dark:text-steel-400">
          Every part lives in a bin, and every bin carries a barcode. Scanning
          that barcode is what moves the count — everything here is a view onto
          that.
        </p>
      </div>

      <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-steel-200 bg-steel-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-steel-800 dark:bg-steel-800">
        {SURFACES.map((surface) => (
          <Link
            key={surface.href}
            href={surface.href}
            // One shared grid gap doubles as the hairline between cells, so the
            // set reads as a single panel rather than six floating cards.
            className="group bg-white p-6 transition-colors hover:bg-steel-50 dark:bg-steel-900 dark:hover:bg-steel-800"
          >
            <h2 className="text-base font-bold text-steel-900 dark:text-steel-50">
              {surface.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-steel-600 dark:text-steel-400">
              {surface.body}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
