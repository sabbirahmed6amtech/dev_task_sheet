"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatClock, formatDay } from "@/lib/time";
import { STATUSES, type Profile, type Task, type TaskStatus } from "@/lib/types";

const hasText = (t: Task) => Boolean(t.ticket_id || t.client_name || t.description);
const line = (t: Task) => {
  const head = [t.ticket_id, t.client_name].filter(Boolean).join(" - ");
  return head && t.description ? `${head}: ${t.description}` : head || t.description || "";
};

/** Today at a glance: team totals, and what each dev is on right now. Updates live. */
export function Dashboard({
  today,
  profiles,
  initialTasks,
}: {
  today: string;
  profiles: Profile[];
  initialTasks: Task[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState(initialTasks);

  useEffect(() => {
    const channel = supabase
      .channel(`admin-tasks:${today}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string }).id;
          setTasks((ts) => ts.filter((t) => t.id !== id));
          return;
        }
        const row = payload.new as Task;
        setTasks((ts) => [...ts.filter((t) => t.id !== row.id), ...(row.work_date === today ? [row] : [])]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, today]);

  const real = tasks.filter(hasText);
  const count = (s: TaskStatus, list: Task[] = real) => list.filter((t) => t.status === s).length;
  const rows = profiles.map((p) => {
    const mine = real.filter((t) => t.dev_id === p.id).sort((a, b) => a.priority - b.priority);
    return { p, mine, working: mine.filter((t) => t.status === "in_progress") };
  });
  const idle = rows.filter((r) => r.working.length === 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[18px] font-semibold">Today</h1>
          <p className="text-[13px] text-neutral-500">{formatDay(today)} · updates live</p>
        </div>
        <Link href="/" className="text-[13px] font-medium text-sheet-head hover:underline">
          Open today&apos;s sheet →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Tasks" value={real.length} />
        {(["in_progress", "paused", "completed", "not_started"] as const).map((s) => {
          const st = STATUSES.find((x) => x.value === s)!;
          return <Stat key={s} label={st.label} value={count(s)} className={st.className} />;
        })}
      </div>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold">Right now</h2>
          <span className="text-[12px] text-neutral-500">
            {idle === 0 ? "Everyone has something in progress" : `${idle} of ${rows.length} with nothing in progress`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="sheet-table min-w-[760px]">
            <thead>
              <tr>
                <th>Dev</th>
                <th>Working on</th>
                <th className="text-center">Not started</th>
                <th className="text-center">Paused</th>
                <th className="text-center">Done</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, mine, working }) => (
                <tr key={p.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">{p.name}</td>
                  <td className="px-4 py-2.5">
                    {working.length === 0 ? (
                      <span className="text-neutral-400">Nothing in progress</span>
                    ) : (
                      working.map((t) => (
                        <div key={t.id} className="flex gap-2">
                          <span className="min-w-0 flex-1 truncate" title={line(t)}>
                            {line(t)}
                          </span>
                          {t.started_at && (
                            <span className="shrink-0 text-[12px] text-neutral-500">
                              since {formatClock(t.started_at)}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </td>
                  <Num value={count("not_started", mine)} />
                  <Num value={count("paused", mine)} />
                  <Num value={count("completed", mine)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-[22px] font-semibold tabular-nums ${className}`}>{value}</div>
    </div>
  );
}

function Num({ value }: { value: number }) {
  return (
    <td className={`px-3 py-2.5 text-center tabular-nums ${value ? "text-neutral-800" : "text-neutral-300"}`}>
      {value}
    </td>
  );
}
