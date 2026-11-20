"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { signOut, useAdminSession } from "@/lib/adminApi";
import { SignInForm } from "@/components/admin/SignInForm";
import { BinQuantityForm } from "@/components/admin/BinQuantityForm";
import { CreatePartForm } from "@/components/admin/CreatePartForm";
import { CreateBinForm } from "@/components/admin/CreateBinForm";
import { BinList } from "@/components/admin/BinList";
import {
  buttonSecondary,
  pageTitle,
  sectionTitle,
} from "@/components/admin/formStyles";

export default function AdminPage() {
  const { user, ready, refresh } = useAdminSession();

  // Bumped after any write, so the lists below refetch their current page.
  // Nothing is preloaded: each list and picker queries Postgres for what it
  // needs, so this page no longer downloads the catalog to render.
  const [dataVersion, setDataVersion] = useState(0);
  const refreshData = useCallback(() => setDataVersion((v) => v + 1), []);

  if (!ready) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-steel-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <SignInForm onSignedIn={refresh} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitle}>Admin</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/activity" className={buttonSecondary}>
            Activity
          </Link>
          {/* Managing accounts is the one thing an owner can do that an admin
              cannot, so the link is only there for owners — the route refuses
              non-owners regardless. */}
          {user.role === "owner" && (
            <Link href="/admin/users" className={buttonSecondary}>
              People
            </Link>
          )}
          <Link href="/admin/labels" className={buttonSecondary}>
            Bin labels
          </Link>
          <button
            type="button"
            className={buttonSecondary}
            onClick={async () => {
              // Demo: this resets the made-up data rather than signing out.
              await signOut();
              await refresh();
              refreshData();
            }}
          >
            Reset demo
          </button>
        </div>
      </div>

      <section className="mt-6 space-y-4">
        <h2 className={sectionTitle}>Stock</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <BinQuantityForm mode="restock" onDone={refreshData} />
          <BinQuantityForm mode="subtract" onDone={refreshData} />
          <BinQuantityForm mode="correct" onDone={refreshData} />
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className={sectionTitle}>Catalog</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <CreatePartForm onDone={refreshData} />
          <CreateBinForm onDone={refreshData} />
        </div>
        <BinList refreshToken={dataVersion} />
      </section>
    </div>
  );
}
