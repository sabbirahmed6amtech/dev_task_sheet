"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PRIORITIES, WEEKDAYS, type Profile, type RecurringTask } from "@/lib/types";

const WORK_WEEK = [0, 1, 2, 3, 4]; // Sun–Thu

type Draft = Omit<RecurringTask, "id" | "created_at">;
const EMPTY: Draft = {
  ticket_id: null,
  client_name: null,
  description: "",
  priority: 1,
  dev_ids: [],
  weekdays: WORK_WEEK,
  active: true,
};

export function daysLabel(days: number[]) {
  const set = [...days].sort();
  if (set.length === 7) return "Every day";
  if (set.join() === WORK_WEEK.join()) return "Sun–Thu";
  return set.map((d) => WEEKDAYS[d]).join(", ") || "No days";
}

/**
 * Tasks added to the chosen devs' sheets automatically on the chosen weekdays,
 * e.g. "Check all submitted apps status and resubmit rejected ones".
 */
export function DailyTasks({ initial, profiles }: { initial: RecurringTask[]; profiles: Profile[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.name])), [profiles]);

  async function reload() {
    const { data } = await supabase.from("recurring_tasks").select("*").order("created_at");
    if (data) setItems(data as RecurringTask[]);
  }

  async function save() {
    if (!editing) return;
    const { id, draft } = editing;
    const row = {
      ...draft,
      ticket_id: draft.ticket_id?.trim() || null,
      client_name: draft.client_name?.trim() || null,
      description: draft.description.trim(),
    };
    const res = id
      ? await supabase.from("recurring_tasks").update(row).eq("id", id).select("id").single()
      : await supabase.from("recurring_tasks").insert(row).select("id").single();
    if (res.error) return setMessage({ ok: false, text: res.error.message });

    // Put it on today's sheet right away for anyone who doesn't have it yet.
    const applied = await supabase.rpc("admin_apply_recurring", { p_id: res.data.id });
    setMessage(
      applied.error
        ? { ok: false, text: `Saved, but couldn't add it to today's sheet: ${applied.error.message}` }
        : { ok: true, text: "Saved. It's on today's sheet (if today is one of its days) and will be added every matching day." },
    );
    setEditing(null);
    reload();
  }

  async function setActive(item: RecurringTask, active: boolean) {
    const { error } = await supabase.from("recurring_tasks").update({ active }).eq("id", item.id);
    if (!error && active) await supabase.rpc("admin_apply_recurring", { p_id: item.id });
    setMessage(error ? { ok: false, text: error.message } : { ok: true, text: active ? "Resumed." : "Paused — it won't be added on new days." });
    reload();
  }

  async function remove(item: RecurringTask) {
    if (!window.confirm(`Delete the daily task "${item.description}"? Tasks it already added stay on their sheets.`)) return;
    const { error } = await supabase.from("recurring_tasks").delete().eq("id", item.id);
    setMessage(error ? { ok: false, text: error.message } : { ok: true, text: "Deleted." });
    reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[18px] font-semibold">Daily tasks</h1>
          <p className="text-[13px] text-neutral-500">
            Added automatically to the chosen devs&apos; sheets on the chosen days. Unfinished ones
            don&apos;t carry over — each day gets a fresh one.
          </p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing({ id: null, draft: EMPTY })} className="btn btn-primary">
            + New daily task
          </button>
        )}
      </div>

      {message && (
        <div
          className={`flex items-center justify-between rounded-md px-3 py-2 text-[12.5px] ${
            message.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
          <button type="button" onClick={() => setMessage(null)} className="px-2 opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {editing && (
        <Editor
          draft={editing.draft}
          isNew={!editing.id}
          profiles={profiles}
          onChange={(draft) => setEditing({ ...editing, draft })}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      <section>
        {items.length === 0 ? (
          <p className="card px-4 py-6 text-center text-[13px] text-neutral-500">
            No daily tasks yet. Add one for work that someone does every day.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="sheet-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Task</th>
                  <th className="text-center">Priority</th>
                  <th>Devs</th>
                  <th>Days</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const head = [item.ticket_id, item.client_name].filter(Boolean).join(" - ");
                  const devs = item.dev_ids.map((id) => names.get(id)).filter(Boolean);
                  return (
                    <tr key={item.id} className={`align-top ${item.active ? "" : "text-neutral-400"}`}>
                      <td className="px-4 py-2.5">
                        {head && <span className="font-medium">{head}: </span>}
                        {item.description}
                        {!item.active && <span className="ml-2 text-[11.5px]">(paused)</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">P{item.priority}</td>
                      <td className="px-3 py-2.5">
                        {devs.length === profiles.length ? "Everyone" : devs.join(", ") || <span className="text-rose-600">No one</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{daysLabel(item.weekdays)}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const { id, created_at: _, ...draft } = item;
                              setEditing({ id, draft });
                            }}
                            className="rounded px-2 py-1 text-[12.5px] font-medium text-neutral-700 hover:bg-black/5"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setActive(item, !item.active)}
                            className="rounded px-2 py-1 text-[12.5px] font-medium text-neutral-700 hover:bg-black/5"
                          >
                            {item.active ? "Pause" : "Resume"}
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(item)}
                            className="rounded px-2 py-1 text-[12.5px] font-medium text-rose-600 hover:bg-rose-500/10"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Editor({
  draft,
  isNew,
  profiles,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft;
  isNew: boolean;
  profiles: Profile[];
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const allDevs = draft.dev_ids.length === profiles.length;
  const canSave = draft.description.trim() && draft.dev_ids.length > 0 && draft.weekdays.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSave();
      }}
      className="card space-y-4 p-4"
    >
      <h2 className="text-[14px] font-semibold">{isNew ? "New daily task" : "Edit daily task"}</h2>

      <div className="grid gap-3 sm:grid-cols-[140px_200px_1fr_90px]">
        <div>
          <label className="label">Ticket ID</label>
          <input value={draft.ticket_id ?? ""} onChange={(e) => set("ticket_id", e.target.value)} className="field" placeholder="Optional" />
        </div>
        <div>
          <label className="label">Client</label>
          <input value={draft.client_name ?? ""} onChange={(e) => set("client_name", e.target.value)} className="field" placeholder="Optional" />
        </div>
        <div>
          <label className="label">Task</label>
          <input
            required
            autoFocus
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            className="field"
            placeholder="Check all submitted apps status and if rejected, resubmit with fix"
          />
        </div>
        <div>
          <label className="label">Priority</label>
          <select value={draft.priority} onChange={(e) => set("priority", Number(e.target.value))} className="field">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>P{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-3">
          <span className="label mb-0">Devs</span>
          <button
            type="button"
            onClick={() => set("dev_ids", allDevs ? [] : profiles.map((p) => p.id))}
            className="text-[12px] font-medium text-sheet-head hover:underline"
          >
            {allDevs ? "Clear" : "Select everyone"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {profiles.map((p) => {
            const on = draft.dev_ids.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => set("dev_ids", toggle(draft.dev_ids, p.id))}
                className={`rounded-md border px-2.5 py-1 text-[12.5px] ${
                  on ? "border-sheet-head bg-sheet-head text-white" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="label">Days</span>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d, i) => {
            const on = draft.weekdays.includes(i);
            return (
              <button
                key={d}
                type="button"
                onClick={() => set("weekdays", toggle(draft.weekdays, i).sort())}
                className={`w-12 rounded-md border py-1 text-[12.5px] ${
                  on ? "border-sheet-head bg-sheet-head text-white" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-neutral-100 pt-3">
        <button type="submit" disabled={!canSave} className="btn btn-primary">
          {isNew ? "Add daily task" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel} className="btn border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50">
          Cancel
        </button>
        {!canSave && <span className="text-[12px] text-neutral-500">Needs a task, at least one dev and one day.</span>}
      </div>
    </form>
  );
}
