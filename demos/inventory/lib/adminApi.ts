"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminRole } from "@/lib/types";
import { resetDemo, subscribe } from "@/lib/demo/store";
import { HttpError, currentUser, handleAdminRequest } from "@/lib/demo/adminHandlers";

// The demo version of the admin API client.
//
// In the real app this file holds a sign-in token and sends each request to a
// server route. The demo has no server and no accounts to sign in to: you are
// always the owner ("Demo Owner"), and each request is answered straight away
// by a function in lib/demo/adminHandlers.ts working on in-memory data.
//
// Everything exported here has the same name and shape as the real file, so
// the pages that import it did not have to change.

export type SessionUser = {
  id: string;
  username: string;
  display_name: string;
  role: AdminRole;
};

// The account the demo is signed in as (its name can be edited on People).
function demoUser(): SessionUser {
  return currentUser() as SessionUser;
}

// There is no token in the demo; kept so the export list matches the original.
export function getToken(): string | null {
  return "demo";
}

export function getCachedUser(): SessionUser | null {
  return demoUser();
}

export class AdminApiError extends Error {
  status: number;
  // The server's machine-readable reason, where it sent one. Never set in the
  // demo, but kept so the type matches.
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// A short pause so buttons show their "Saving…" state, as they would while a
// real request is on its way.
const PAUSE_MS = 120;

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  try {
    // Copy the answer so a page can never hold a live reference to a table row.
    return structuredClone(handleAdminRequest(method, path, body)) as T;
  } catch (err) {
    if (err instanceof HttpError) throw new AdminApiError(err.message, err.status);
    throw new AdminApiError("Request failed", 500);
  }
}

export const adminGet = <T = unknown>(path: string) =>
  request<T>("GET", path);

export const adminPost = <T = unknown>(path: string, body: unknown) =>
  request<T>("POST", path, body);

export const adminPatch = <T = unknown>(path: string, body: unknown) =>
  request<T>("PATCH", path, body);

export const adminDelete = <T = unknown>(path: string, body: unknown) =>
  request<T>("DELETE", path, body);

// --- Sign in / sign out ---------------------------------------------------

// Nothing to check: any username and password "work", and nothing is stored.
export async function signIn(
  _username: string,
  _password: string,
): Promise<SessionUser> {
  return demoUser();
}

// In the demo, "signing out" puts all the made-up data back the way it
// started. You stay signed in as the demo owner.
export async function signOut(): Promise<void> {
  resetDemo();
}

// --- The signed-in account ------------------------------------------------

export type Session = {
  user: SessionUser | null;
  // Always true in the demo: there is no server to wait for.
  ready: boolean;
  refresh: () => Promise<void>;
};

// Who is signed in: always the demo owner. It re-reads the account when the
// People page renames it, so the header stays in step.
export function useAdminSession(): Session {
  const [user, setUser] = useState<SessionUser | null>(demoUser);

  const refresh = useCallback(async () => {
    setUser(demoUser());
  }, []);

  useEffect(() => subscribe("admin_users", () => setUser(demoUser())), []);

  return { user, ready: true, refresh };
}
