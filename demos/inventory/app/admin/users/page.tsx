"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  adminDelete,
  adminGet,
  adminPatch,
  adminPost,
  useAdminSession,
} from "@/lib/adminApi";
import { SignInForm } from "@/components/admin/SignInForm";
import {
  button,
  buttonDangerSmall,
  buttonSecondary,
  buttonSmall,
  card,
  input,
  label,
  pageTitle,
  sectionTitle,
  tableHead,
} from "@/components/admin/formStyles";
import { MIN_PASSWORD_LENGTH } from "@/lib/types";
import type { AdminRole, AdminUser } from "@/lib/types";

// Owner-only account management.
//
// Passwords are typed into this page by the owner and sent straight to the
// server, which hashes them in Postgres. Nothing here generates a password,
// mails one, or shows one back — the owner tells the person theirs directly.

export default function UsersPage() {
  const { user, ready, refresh } = useAdminSession();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || user.role !== "owner") return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminGet<{ users: AdminUser[] }>("/api/admin/users");
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load accounts.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

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

  // The route refuses non-owners anyway; this is so an admin who follows a
  // link gets a sentence rather than a failed request.
  if (user.role !== "owner") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-steel-600 dark:text-steel-400">
          Only an owner can manage accounts.
        </p>
        <Link href="/admin" className={`${buttonSecondary} mt-4`}>
          Back to admin
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={pageTitle}>People</h1>
          <p className="mt-1 text-sm text-steel-500 dark:text-steel-400">
            Who can sign in to the admin tools.
          </p>
        </div>
        <Link href="/admin" className={buttonSecondary}>
          Back to admin
        </Link>
      </div>

      <section className="mt-6">
        <h2 className={sectionTitle}>Accounts</h2>
        {error && <p className="mt-2 text-sm text-stock-none">{error}</p>}
        <div className="mt-2 overflow-x-auto rounded-lg border border-steel-200 dark:border-steel-800">
          <table className="w-full text-left text-sm">
            <thead className={tableHead}>
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Username</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-200 dark:divide-steel-800">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-steel-500">
                    Loading…
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <UserRow
                    key={u.id}
                    account={u}
                    isSelf={u.id === user.id}
                    onChanged={load}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className={sectionTitle}>Add someone</h2>
        <div className="mt-2">
          <CreateUserForm onDone={load} />
        </div>
      </section>
    </div>
  );
}

// Which inline editor a row has open, if any.
type RowMode = null | "reset" | "edit" | "delete";

function UserRow({
  account,
  isSelf,
  onChanged,
}: {
  account: AdminUser;
  isSelf: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  // One row shows one thing at a time: the buttons, or the form for whichever
  // was pressed. Two open editors in a table row is unreadable at this width.
  const [mode, setMode] = useState<RowMode>(null);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(account.display_name);
  const [role, setRole] = useState<AdminRole>(account.role);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setMode(null);
    setPassword("");
    setError(null);
  }

  // The edit fields are seeded when the editor opens rather than held in sync,
  // so they start from the row as it currently stands after any reload.
  function openEdit() {
    setDisplayName(account.display_name);
    setRole(account.role);
    setError(null);
    setMode("edit");
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: Record<string, unknown>) =>
    run(() => adminPatch("/api/admin/users", { user_id: account.id, ...body }));

  const destroy = () =>
    run(() => adminDelete("/api/admin/users", { user_id: account.id }));

  const renamed = displayName.trim() !== account.display_name;
  const rerolled = role !== account.role;

  return (
    <tr>
      <td className="px-3 py-2 font-semibold">
        {account.display_name}
        {isSelf && (
          <span className="ml-1.5 text-[12px] font-normal text-steel-500">
            (you)
          </span>
        )}
      </td>
      <td className="px-3 py-2 font-mono text-steel-600 dark:text-steel-400">
        {account.username}
      </td>
      <td className="px-3 py-2">{account.role}</td>
      <td className="px-3 py-2">
        {account.active ? (
          "Active"
        ) : (
          <span className="text-steel-500">Deactivated</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {mode === "reset" && (
            <>
              <input
                className={`${input} mt-0 w-44`}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                className={buttonSmall}
                disabled={busy || password.length < MIN_PASSWORD_LENGTH}
                onClick={async () => {
                  if (await patch({ password })) close();
                }}
              >
                Save
              </button>
              <button type="button" className={buttonSmall} onClick={close}>
                Cancel
              </button>
            </>
          )}

          {mode === "edit" && (
            <>
              <input
                className={`${input} mt-0 w-40`}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                autoFocus
              />
              <select
                className={`${input} mt-0 w-28`}
                value={role}
                onChange={(e) => setRole(e.target.value as AdminRole)}
              >
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
              <button
                type="button"
                className={buttonSmall}
                disabled={
                  busy || !displayName.trim() || (!renamed && !rerolled)
                }
                onClick={async () => {
                  // Only what actually changed is sent, so the activity log
                  // does not record a rename that renamed nothing.
                  const ok = await patch({
                    ...(renamed ? { display_name: displayName.trim() } : {}),
                    ...(rerolled ? { role } : {}),
                  });
                  if (ok) close();
                }}
              >
                Save
              </button>
              <button type="button" className={buttonSmall} onClick={close}>
                Cancel
              </button>
            </>
          )}

          {mode === "delete" && (
            <>
              <span className="text-sm text-steel-600 dark:text-steel-400">
                Delete {account.username}? Their activity stays on the log.
              </span>
              <button
                type="button"
                className={buttonDangerSmall}
                disabled={busy}
                onClick={() => destroy()}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
              <button type="button" className={buttonSmall} onClick={close}>
                Cancel
              </button>
            </>
          )}

          {mode === null && (
            <>
              <button
                type="button"
                className={buttonSmall}
                disabled={busy}
                onClick={openEdit}
              >
                Edit
              </button>
              <button
                type="button"
                className={buttonSmall}
                disabled={busy}
                onClick={() => setMode("reset")}
              >
                Reset password
              </button>
              <button
                type="button"
                className={buttonSmall}
                disabled={busy}
                onClick={() => patch({ active: !account.active })}
              >
                {account.active ? "Deactivate" : "Reactivate"}
              </button>
              {/* The route refuses this anyway; hiding it keeps an owner from
                  reaching for the one button that cannot work. */}
              {!isSelf && (
                <button
                  type="button"
                  className={buttonDangerSmall}
                  disabled={busy}
                  onClick={() => setMode("delete")}
                >
                  Delete
                </button>
              )}
            </>
          )}
          {error && <span className="text-sm text-stock-none">{error}</span>}
        </div>
      </td>
    </tr>
  );
}

function CreateUserForm({ onDone }: { onDone: () => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await adminPost("/api/admin/users", {
        username,
        display_name: displayName,
        role,
        password,
      });
      setDone(`Created ${displayName}. Tell them their password yourself.`);
      setUsername("");
      setDisplayName("");
      setPassword("");
      setRole("admin");
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={card}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="new-name">
            Display name
          </label>
          <input
            id="new-name"
            className={input}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Winny"
          />
        </div>
        <div>
          <label className={label} htmlFor="new-username">
            Username
          </label>
          <input
            id="new-username"
            className={`${input} font-mono`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="winny"
          />
        </div>
        <div>
          <label className={label} htmlFor="new-role">
            Role
          </label>
          <select
            id="new-role"
            className={input}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="admin">Admin — stock and catalog</option>
            <option value="owner">Owner — that, plus managing people</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="new-password">
            Password
          </label>
          <input
            id="new-password"
            className={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className={button}
          disabled={busy || !username || !displayName || password.length < MIN_PASSWORD_LENGTH}
        >
          {busy ? "Creating…" : "Create account"}
        </button>
        {error && <span className="text-sm text-stock-none">{error}</span>}
        {done && (
          <span className="text-sm text-steel-600 dark:text-steel-400">
            {done}
          </span>
        )}
      </div>
    </form>
  );
}
