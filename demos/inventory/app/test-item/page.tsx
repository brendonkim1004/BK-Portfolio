"use client";

import Link from "next/link";
import { button } from "@/components/admin/formStyles";
import { Barcode } from "@/components/Barcode";
import { TEST_ITEM_CODE } from "@/lib/types";

export default function TestItemPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Test item</h1>
          <p className="mt-1 text-sm text-steel-600 dark:text-steel-400">
            A throwaway part for checking that scanners work. It behaves like any
            other item — scanning it on the Scan page subtracts one, and it adds
            one while restock mode is on. It starts at 100 units and is pinned to
            the top of{" "}
            <Link href="/stock" className="underline">
              Live Stock
            </Link>{" "}
            so you can watch the count move.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className={`${button} shrink-0`}
        >
          Print
        </button>
      </div>

      <div className="mt-8 flex flex-col items-center rounded-lg border border-steel-300 bg-white p-8 text-center dark:border-steel-700 dark:bg-steel-900">
        <div className="text-[13px] font-bold text-steel-600 dark:text-steel-400">
          Test item — scanner testing
        </div>
        <div className="mt-4">
          <Barcode value={TEST_ITEM_CODE} width={3} height={120} />
        </div>
        <p className="mt-4 max-w-md text-sm text-steel-600 dark:text-steel-400">
          Safe to scan as often as you like — it only ever moves this item&apos;s
          count, never real inventory.
        </p>
      </div>
    </div>
  );
}
