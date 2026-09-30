"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const DEFAULT_PASSWORD = "12345678";

/**
 * The team: add people, fix names and emails, reset passwords, set who's an admin,
 * order the sheet, and deactivate people who leave (their history stays).
 */
export function Users({ initial, meId }: { initial: Profile[]; meId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [people, setPeople] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const active = people.filter((p) => p.active);
  const inactive = people.filter((p) => !p.active);

  async function reload() {
    const { data } = await supabase.from("profiles").select("*").order("sort_order");
    if (data) setPeople(data as Profile[]);
  }

  // Runs an admin action, then shows its result and refreshes the list.
  async function run(action: PromiseLike<{ error: { message: string } | null }>, done: string) {
    const { error } = await action;
    setMessage(error ? { ok: false, text: error.message } : { ok: true, text: done });
    await reload();
    return !error;
  }

  async function move(index: number, delta: number) {
    const a = active[index];
    const b = active[index + delta];
    if (!b) return;
    // Renumber the whole list so ties or gaps in sort_order can't make a swap a no-op.
    const order = active.map((p) => p.id);
    [order[index], order[index + delta]] = [order[index + delta], order[index]];
    setPeople((ps) =>
      [...ps].sort((x, y) => {
        const ix = order.indexOf(x.id);
        const iy = order.indexOf(y.id);
        return (ix < 0 ? 1e6 : ix) - (iy < 0 ? 1e6 : iy);
      }),
    );
    const results = await Promise.all(
      order.map((id, i) => supabase.from("profiles").update({ sort_order: i + 1 }).eq("id", id)),
    );
    const failed = results.find((r) => r.error);
    setMessage(failed ? { ok: false, text: failed.error!.message } : { ok: true, text: `Moved ${a.name}.` });
    await reload();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold">Users</h1>
        <p className="text-[13px] text-neutral-500">
          Order here is the order on the sheet. Deactivated people can&apos;t sign in and leave the
          sheet, but their past tasks stay.
        </p>
      </div>

      <AddUser
        onAdd={(name, email, password) =>
          run(
            supabase.rpc("admin_create_user", { p_name: name, p_email: email, p_password: password }),
            `Added ${name}. They can sign in with ${email.trim().toLowerCase()} and the password you set.`,
          )
        }
      />

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

      <section className="overflow-x-auto">
        <div>
          <table className="sheet-table min-w-[820px]">
            <thead>
              <tr>
                <th className="w-16 text-center">Order</th>
                <th>Name</th>
                <th>Email</th>
                <th className="w-20 text-center">Admin</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map((p, i) => (
                <UserRow
                  key={p.id}
                  person={p}
                  isMe={p.id === meId}
                  order={
                    <div className="flex items-center justify-center gap-0.5 text-neutral-500">
                      <span className="w-5 text-center tabular-nums">{i + 1}</span>
                      <div className="flex flex-col">
                        <button type="button" disabled={i === 0} onClick={() => move(i, -1)} title="Move up" className="px-1 leading-none hover:text-neutral-900 disabled:opacity-25">
                          ▲
                        </button>
                        <button type="button" disabled={i === active.length - 1} onClick={() => move(i, 1)} title="Move down" className="px-1 leading-none hover:text-neutral-900 disabled:opacity-25">
                          ▼
                        </button>
                      </div>
                    </div>
                  }
                  run={run}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {inactive.length > 0 && (
        <section>
          <h2 className="mb-2 text-[14px] font-semibold text-neutral-600">Deactivated</h2>
          <table className="sheet-table">
            <tbody>
              {inactive.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-neutral-500">{p.name}</td>
                  <td className="px-3 py-2 text-neutral-400">{p.email}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        run(supabase.rpc("admin_set_active", { p_user: p.id, p_active: true }), `${p.name} is active again.`)
                      }
                      className="rounded px-2 py-1 text-[12.5px] font-medium text-neutral-700 hover:bg-black/5"
                    >
                      Reactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function AddUser({ onAdd }: { onAdd: (name: string, email: string, password: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        if (await onAdd(name, email, password)) {
          setName("");
          setEmail("");
          setPassword(DEFAULT_PASSWORD);
        }
        setBusy(false);
      }}
      className="card flex flex-wrap items-end gap-3 p-4"
    >
      <div className="min-w-44 flex-1">
        <label className="label">Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="field" />
      </div>
      <div className="min-w-56 flex-1">
        <label className="label">Email</label>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
      </div>
      <div className="w-40">
        <label className="label">Password</label>
        <input required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
      </div>
      <button type="submit" disabled={busy} className="btn btn-primary">
        Add member
      </button>
    </form>
  );
}

function UserRow({
  person: p,
  isMe,
  order,
  run,
}: {
  person: Profile;
  isMe: boolean;
  order: React.ReactNode;
  run: (action: PromiseLike<{ error: { message: string } | null }>, done: string) => Promise<boolean>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<"view" | "edit" | "password">("view");
  const [name, setName] = useState(p.name);
  const [email, setEmail] = useState(p.email);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);

  async function save() {
    if (await run(supabase.rpc("admin_update_user", { p_user: p.id, p_name: name, p_email: email }), `Saved ${name}.`))
      setMode("view");
  }

  async function resetPassword() {
    if (await run(supabase.rpc("admin_set_password", { p_user: p.id, p_password: password }), `New password set for ${p.name}.`))
      setMode("view");
  }

  // Plain text buttons inside the table, like the sheet (no white boxes).
  const ghostBtn = "rounded px-2 py-1 text-[12.5px] font-medium text-neutral-700 hover:bg-black/5";

  return (
    <tr>
      <td className="px-3 py-2">{order}</td>
      {mode === "edit" ? (
        <>
          <td className="px-3 py-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="field" autoFocus />
          </td>
          <td className="px-3 py-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
          </td>
        </>
      ) : (
        <>
          <td className="px-3 py-2 font-medium">
            {p.name}
            {isMe && <span className="ml-1.5 text-[11.5px] font-normal text-neutral-400">(you)</span>}
          </td>
          <td className="px-3 py-2 text-neutral-600">{p.email}</td>
        </>
      )}
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={p.is_admin}
          disabled={isMe}
          title={isMe ? "You can't remove your own admin access" : undefined}
          onChange={(e) =>
            run(
              supabase.from("profiles").update({ is_admin: e.target.checked }).eq("id", p.id),
              e.target.checked ? `${p.name} is now an admin.` : `${p.name} is no longer an admin.`,
            )
          }
          className="size-4 accent-sheet-head"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          {mode === "edit" && (
            <>
              <button type="button" onClick={save} className="btn btn-primary">Save</button>
              <button type="button" onClick={() => { setName(p.name); setEmail(p.email); setMode("view"); }} className={ghostBtn}>Cancel</button>
            </>
          )}
          {mode === "password" && (
            <>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field w-36"
                aria-label="New password"
                autoFocus
              />
              <button type="button" onClick={resetPassword} className="btn btn-primary">Set</button>
              <button type="button" onClick={() => setMode("view")} className={ghostBtn}>Cancel</button>
            </>
          )}
          {mode === "view" && (
            <>
              <button type="button" onClick={() => setMode("edit")} className={ghostBtn}>Edit</button>
              <button type="button" onClick={() => setMode("password")} className={ghostBtn}>Reset password</button>
              {!isMe && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Deactivate ${p.name}? They won't be able to sign in, and won't appear on new days.`))
                      run(supabase.rpc("admin_set_active", { p_user: p.id, p_active: false }), `${p.name} is deactivated.`);
                  }}
                  className="rounded px-2 py-1 text-[12.5px] font-medium text-rose-600 hover:bg-rose-500/10"
                >
                  Deactivate
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
