"use client";

import { Barcode } from "@/components/Barcode";
import { button } from "@/components/admin/formStyles";
import { RESTOCK_MODE_CODE } from "@/lib/types";

export default function RestockPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Restock mode</h1>
          <p className="mt-1 text-sm text-steel-600 dark:text-steel-400">
            Scan this barcode on the Scan page to switch into ADD mode — every
            part you scan afterwards adds one unit to stock (for receiving
            inventory). Scan the PROJECT-DONE barcode or any project barcode to
            return to normal.
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

      <div className="mt-8 flex flex-col items-center rounded-lg border border-brand/40 bg-brand-wash p-8 text-center dark:bg-brand/10">
        <div className="text-[13px] font-bold text-brand-text dark:text-brand">
          Restock — add stock
        </div>
        <div className="mt-4">
          <Barcode value={RESTOCK_MODE_CODE} width={3} height={120} />
        </div>
        <p className="mt-4 max-w-md text-sm text-steel-600 dark:text-steel-400">
          Scan to start adding. Each following scan adds one unit to that bin.
        </p>
      </div>
    </div>
  );
}
