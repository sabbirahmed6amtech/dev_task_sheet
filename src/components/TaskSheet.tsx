"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "./Header";
import { TaskRow, type Shared } from "./TaskRow";
import { eodReport, hasContent, statusPatch, type ParsedTask } from "@/lib/taskText";
import type { Profile, Task, TaskPatch } from "@/lib/types";

const HEADERS: { label: string; width?: number }[] = [
  { label: "SL", width: 40 },
  { label: "Dev", width: 164 },
  { label: "Ticket ID", width: 128 },
  { label: "Client Name", width: 124 },
  { label: "Task Description" },
  { label: "Priority", width: 72 },
  { label: "Status", width: 116 },
  { label: "Start Time", width: 134 },
  { label: "End Time", width: 134 },
  { label: "Note", width: 56 },
  { label: "", width: 28 },
];

const byOrder = (a: Task, b: Task) =>
  a.priority - b.priority || a.created_at.localeCompare(b.created_at);

export function TaskSheet({
  date,
  today,
  profiles,
  initialTasks,
  me,
  loadError,
}: {
  date: string;
  today: string;
  profiles: Profile[];
  initialTasks: Task[];
  me: Profile | null;
  loadError: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [error, setError] = useState<string | null>(loadError);

  // Each dev's empty entry row gets the id its task will have once someone types
  // in it, so the row keeps focus when it turns into a real task.
  const [entryIds, setEntryIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(profiles.map((p) => [p.id, crypto.randomUUID()])),
  );
  // What's been picked on a dev's entry row before anything was typed (priority,
  // status, times). It stays on screen only, and is saved with the row's first text.
  const [drafts, setDrafts] = useState<Record<string, TaskPatch>>({});
  // Inserts still in flight, so an edit made right after creating waits for it.
  const inserting = useRef(new Map<string, Promise<boolean>>());

  const reload = useCallback(async () => {
    const { data } = await supabase.from("tasks").select("*").eq("work_date", date);
    if (data) setTasks(data as Task[]);
  }, [supabase, date]);

  // Live updates: changes other people make show up without a refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`tasks:${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string }).id;
          if (id) setTasks((ts) => ts.filter((t) => t.id !== id));
          return;
        }
        const row = payload.new as Task;
        setTasks((ts) => {
          const rest = ts.filter((t) => t.id !== row.id);
          return row.work_date === date ? [...rest, row] : rest;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, date]);

  const fail = useCallback(
    (message: string) => {
      setError(`Couldn't save — ${message}`);
      reload();
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, patch: TaskPatch) => {
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      if ((await inserting.current.get(id)) === false) return;
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) fail(error.message);
    },
    [supabase, fail],
  );

  // Without an id this fills the dev's entry row; extra rows from a multi-line paste
  // pass their own.
  const create = useCallback(
    (devId: string, priority: number, patch: TaskPatch, id: string = entryIds[devId]) => {
      const row: Task = {
        id,
        work_date: date,
        dev_id: devId,
        priority,
        ticket_id: null,
        client_name: null,
        description: null,
        status: "not_started",
        started_at: null,
        ended_at: null,
        notes: null,
        carried_from: null,
        origin_date: date,
        created_at: new Date().toISOString(),
        ...patch,
      };
      setTasks((ts) => [...ts, row]);
      if (id === entryIds[devId]) setEntryIds((ids) => ({ ...ids, [devId]: crypto.randomUUID() }));

      const saved = Promise.resolve(
        supabase.from("tasks").insert({ id, work_date: date, dev_id: devId, priority, ...patch }),
      ).then(({ error }) => {
        inserting.current.delete(id);
        if (error) fail(error.message);
        return !error;
      });
      inserting.current.set(id, saved);
    },
    [supabase, date, entryIds, fail],
  );

  // Pasted task lines: the first fills the row it was pasted into, the rest are added
  // below it for the same dev.
  const pasteTasks = useCallback(
    (devId: string, task: Task | null, parsed: ParsedTask[], nextPriority: number, draft?: TaskPatch) => {
      parsed.forEach((p, i) => {
        const patch: TaskPatch = {
          ...(i === 0 && draft),
          description: p.description,
          ...(p.ticket_id && { ticket_id: p.ticket_id }),
          ...(p.client_name && { client_name: p.client_name }),
          ...(p.priority && { priority: p.priority }),
          ...(p.status && statusPatch(i === 0 ? task : null, p.status)),
        };
        const priority = p.priority ?? nextPriority + (task ? i - 1 : i);
        if (i === 0 && task) update(task.id, patch);
        else create(devId, priority, patch, i === 0 ? undefined : crypto.randomUUID());
      });
    },
    [update, create],
  );

  const clearDraft = (devId: string) =>
    setDrafts(({ [devId]: _, ...rest }) => rest);

  const remove = useCallback(
    async (task: Task) => {
      const label = task.description || task.client_name || task.ticket_id || "this task";
      if (!window.confirm(`Delete "${label}"?`)) return;
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) fail(error.message);
    },
    [supabase, fail],
  );

  // Your own block comes first, then everyone else in the team's usual order.
  const groups = useMemo(
    () =>
      [...profiles]
        .sort((a, b) => Number(b.id === me?.id) - Number(a.id === me?.id))
        .map((p) => ({
          profile: p,
          tasks: tasks.filter((t) => t.dev_id === p.id).sort(byOrder),
        })),
    [profiles, tasks, me?.id],
  );

  // Tickets split between devs (e.g. app + backend): each row lists the other devs on it.
  const byTicket = useMemo(() => {
    const names = new Map(profiles.map((p) => [p.id, p.name]));
    // ticket -> dev -> that dev's statuses on it (a dev may have the ticket on several rows)
    const map = new Map<string, Map<string, Set<Task["status"]>>>();
    for (const t of tasks) {
      const key = t.ticket_id?.trim().toLowerCase();
      if (!key) continue;
      const devs = map.get(key) ?? new Map<string, Set<Task["status"]>>();
      devs.set(t.dev_id, (devs.get(t.dev_id) ?? new Set()).add(t.status));
      map.set(key, devs);
    }
    return { map, names };
  }, [tasks, profiles]);
  const sharedWith = (t: Task): Shared[] =>
    [...(byTicket.map.get(t.ticket_id?.trim().toLowerCase() ?? "") ?? [])]
      .filter(([devId]) => devId !== t.dev_id)
      .map(([devId, statuses]) => ({
        name: byTicket.names.get(devId) ?? "Former member",
        statuses: [...statuses],
      }));

  const eod = me && eodReport(date, tasks.filter((t) => t.dev_id === me.id));
  let rowIndex = 0;

  return (
    <div className="flex h-screen flex-col">
      <Header date={date} today={today} me={me} profiles={profiles} eod={eod} />

      {error && (
        <div className="flex items-center justify-between bg-rose-50 px-4 py-2 text-[12.5px] text-rose-700">
          {error}
          <button type="button" onClick={() => setError(null)} className="px-2 hover:text-rose-900">
            Dismiss
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4">
        <table className="w-full min-w-[1240px] table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg border border-sheet-head bg-white shadow-sm">
          <colgroup>
            {HEADERS.map((h, i) => (
              <col key={i} style={h.width ? { width: h.width } : undefined} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-sheet-head text-left text-[11.5px] font-semibold uppercase tracking-wide text-white">
              {HEADERS.map((h, i) => (
                <th
                  key={i}
                  className={`h-10 bg-sheet-head px-2.5 ${
                    i === 0 ? "sticky left-0 z-[2] text-center" : i === 1 ? "sticky left-10 z-[2] text-center" : ""
                  } ${i === 5 || i === 6 ? "text-center" : ""}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map(({ profile, tasks: devTasks }, g) => {
            const nextPriority = Math.max(0, ...devTasks.map((t) => t.priority)) + 1;
            return (
              <tbody
                key={profile.id}
                className={`${g % 2 ? "[--band:var(--color-sheet-yellow)]" : "[--band:var(--color-sheet-green)]"} bg-(--band) [&>tr:first-child>td]:border-t-2 [&>tr:first-child>td]:border-t-sheet-head/70`}
              >
                {devTasks.map((t, i) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    date={date}
                    devName={profile.name}
                    merge={i === 0 ? { sl: g + 1, rows: devTasks.length + 1 } : null}
                    row={rowIndex++}
                    nextPriority={nextPriority}
                    onChange={(patch) => update(t.id, patch)}
                    onPasteTasks={(parsed) => pasteTasks(profile.id, t, parsed, nextPriority)}
                    sharedWith={sharedWith(t)}
                    onDelete={() => remove(t)}
                  />
                ))}
                <TaskRow
                  key={entryIds[profile.id]}
                  task={null}
                  date={date}
                  devName={profile.name}
                  merge={devTasks.length === 0 ? { sl: g + 1, rows: 1 } : null}
                  row={rowIndex++}
                  nextPriority={nextPriority}
                  draft={drafts[profile.id]}
                  onChange={(patch) => {
                    const merged = { ...drafts[profile.id], ...patch };
                    if (hasContent(merged)) {
                      create(profile.id, merged.priority ?? nextPriority, merged);
                      clearDraft(profile.id);
                    } else setDrafts((d) => ({ ...d, [profile.id]: merged }));
                  }}
                  onPasteTasks={(parsed) => {
                    pasteTasks(profile.id, null, parsed, nextPriority, drafts[profile.id]);
                    clearDraft(profile.id);
                  }}
                  sharedWith={[]}
                />
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
