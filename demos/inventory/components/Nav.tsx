"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useAdminSession } from "@/lib/adminApi";
import { BASE_PATH } from "@/lib/demo/basePath";

const LINKS = [
  { href: "/scan", label: "Scan" },
  { href: "/stock", label: "Stock" },
  { href: "/projects", label: "Projects" },
  { href: "/restock", label: "Restock" },
  { href: "/test-item", label: "Test item" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  const pathname = usePathname();
  const { user, refresh } = useAdminSession();

  return (
    <header className="border-b border-steel-300 bg-white dark:border-steel-800 dark:bg-steel-900 print:hidden">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 px-4">
        {/* The company logo is the wordmark, so the link carries no text of its
            own — "Inventory" sits beside it as the thing this particular tool
            is, divided off the mark by a hairline. */}
        <Link
          href="/"
          className="mr-5 flex items-center gap-2.5 py-2.5"
          aria-label="Concord Inventory — home"
        >
          <Image
            // A plain image path does not get the demo's folder added for it.
            src={`${BASE_PATH}/concord-logo.png`}
            alt="Concord Concrete Pumps"
            width={601}
            height={117}
            priority
            className="h-6 w-auto"
          />
          <span className="border-l border-steel-300 pl-2.5 text-[15px] font-bold tracking-tight text-steel-700 dark:border-steel-700 dark:text-steel-200">
            Inventory
          </span>
        </Link>

        {LINKS.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              // The active tab is marked by a rule along the bottom edge that
              // meets the header border, so the current surface reads as
              // attached to the page below it rather than as a floating pill.
              className={`-mb-px border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${
                active
                  ? "border-brand text-steel-900 dark:text-steel-50"
                  : "border-transparent text-steel-500 hover:text-steel-900 dark:text-steel-400 dark:hover:text-steel-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}

        {/* Demo: "Sign out" became "Reset demo" — it puts the made-up data back
            as it started and you stay signed in. */}
        {/* The signed-in name, always visible. Sessions deliberately survive
            closing the browser, which on a shared shop computer means the next
            person could act as the last one without noticing — this is what
            makes that visible, and the way out is one click. */}
        {user && (
          <div className="ml-auto flex items-center gap-2 py-2 text-sm">
            <span className="text-steel-500 dark:text-steel-400">
              Signed in as{" "}
              <span className="font-semibold text-steel-800 dark:text-steel-200">
                {user.display_name}
              </span>
            </span>
            <span aria-hidden className="text-steel-300 dark:text-steel-700">
              ·
            </span>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                await refresh();
              }}
              className="font-semibold text-steel-500 underline-offset-2 transition-colors hover:text-steel-900 hover:underline dark:text-steel-400 dark:hover:text-steel-100"
            >
              Reset demo
            </button>
          </div>
        )}
      </nav>
      {/* Demo only: say plainly that none of this is real or kept. */}
      <p className="border-t border-steel-200 bg-steel-50 px-4 py-1 text-center text-xs text-steel-500 dark:border-steel-800 dark:bg-steel-950 dark:text-steel-400">
        Demo with made-up data. Nothing is saved.
      </p>
    </header>
  );
}
