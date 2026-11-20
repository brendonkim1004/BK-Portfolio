"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PROJECT_DONE_CODE } from "@/lib/types";
import type { Project } from "@/lib/types";

// The project a manual stock movement is booked to or taken back off, or none.
//
// "No project" is first and is the default, because the movement that needs no
// project — a sale, a write-off, a delivery arriving, a correction to what the
// shelf really holds — is the one someone reaches for without thinking about
// projects at all. Making it the default also keeps the existing behaviour of
// the subtract and restock controls unchanged unless a project is deliberately
// chosen.
//
// Only active projects are listed. Archived ones are finished jobs, and the
// reserved General/Done bucket is excluded for the same reason the scanner
// excludes it: it has its own list and its own meaning.

export const NO_PROJECT = "";

type Props = {
  id: string;
  value: string;
  onChange: (projectId: string) => void;
  className?: string;
  disabled?: boolean;
};

export function ProjectSelect({
  id,
  value,
  onChange,
  className,
  disabled,
}: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("projects")
        .select("id, number, code, name, created_at, archived")
        .eq("archived", false)
        .order("number", { ascending: false });

      if (cancelled) return;
      if (error) {
        setFailed(true);
        return;
      }
      setProjects(
        (data as Project[]).filter((p) => p.code !== PROJECT_DONE_CODE),
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <select
        id={id}
        className={className}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value={NO_PROJECT}>No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            #{p.number} {p.name}
          </option>
        ))}
      </select>
      {/* A failed load must not silently look like "there are no projects",
          which would read as a reason to remove the stock unattributed. */}
      {failed && (
        <span className="text-sm text-stock-none">
          Could not load projects — removing without one.
        </span>
      )}
    </>
  );
}
