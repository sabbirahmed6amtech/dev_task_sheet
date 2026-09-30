"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDay, shiftDate } from "@/lib/time";
import type { Profile } from "@/lib/types";
import { Search } from "./Search";

export function Header({
  date,
  today,
  me,
  profiles,
  eod,
}: {
  date: string;
  today: string;
  me: Profile | null;
  profiles: Profile[];
  /** The signed-in dev's end-of-day report for this date; null when they have no tasks. */
  eod: string | null;
}) {
  const router = useRouter();
  const isToday = date === today;
  const go = (d: string) => router.push(d === today ? "/" : `/?d=${d}`);

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-2.5 max-sm:flex-1">
        <span className="grid size-7 place-items-center rounded-md bg-sheet-head text-[13px] font-bold text-white">
          T
        </span>
        <span className="text-[15px] font-semibold">Dev Task Sheet</span>
      </div>

      <nav className="flex items-center gap-1 max-sm:order-3">
        <Link
          href={`/?d=${shiftDate(date, -1)}`}
          title="Previous day"
          className="grid size-8 place-items-center rounded-md text-neutral-600 hover:bg-neutral-100"
        >
          ‹
        </Link>
        <label className="relative flex cursor-pointer items-center rounded-md px-2 py-1 text-[14px] font-semibold hover:bg-neutral-100">
          {formatDay(date)}
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Pick a day"
          />
        </label>
        {isToday ? (
          <span className="grid size-8 place-items-center text-neutral-300">›</span>
        ) : (
          <Link
            href={`/?d=${shiftDate(date, 1)}`}
            title="Next day"
            className="grid size-8 place-items-center rounded-md text-neutral-600 hover:bg-neutral-100"
          >
            ›
          </Link>
        )}
        {!isToday && (
          <Link href="/" className="ml-1 rounded-md border border-neutral-300 px-2.5 py-1 text-[12.5px] font-medium hover:bg-neutral-50">
            Today
          </Link>
        )}
      </nav>


      <div className="max-sm:order-4 max-sm:w-full">
        <Search profiles={profiles} today={today} />
      </div>

      <div className="ml-auto flex items-center gap-2 max-sm:order-2">
        {me?.is_admin && (
          <Link href="/admin" className="btn border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50">
            Admin
          </Link>
        )}
        {me && <CopyEod text={eod} />}
        {me && <UserMenu me={me} />}
      </div>
    </header>
  );
}

function CopyEod({ text }: { text: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!text) return;
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!text}
      title={text ? `Copy your end-of-day report:\n\n${text}` : "You have no tasks on this day"}
      className="btn border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
    >
      {copied ? "Copied ✓" : "Copy EOD"}
    </button>
  );
}

/** The Clipboard API only exists on https/localhost; the team also opens the app over the LAN. */
async function copyText(text: string) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function UserMenu({ me }: { me: Profile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient().auth.updateUser({ password });
    setMessage(error ? error.message : "Password changed.");
    if (!error) {
      setPassword("");
      setChanging(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] hover:bg-neutral-100"
      >
        <span className="grid size-6 place-items-center rounded-full bg-sheet-green text-[11px] font-semibold text-sheet-head-dark">
          {me.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{me.name}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="card absolute right-0 z-30 mt-1 w-64 p-2 text-[13px]">
            <div className="px-2 py-1.5 text-[11.5px] text-neutral-500">{me.email}</div>
            {changing ? (
              <form onSubmit={changePassword} className="space-y-2 p-2">
                <input
                  type="password"
                  required
                  minLength={6}
                  autoFocus
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field"
                />
                <button type="submit" className="btn btn-primary w-full justify-center">
                  Save password
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setChanging(true);
                  setMessage(null);
                }}
                className="w-full rounded px-2 py-1.5 text-left hover:bg-neutral-100"
              >
                Change password
              </button>
            )}
            {message && <p className="px-2 py-1 text-[12px] text-neutral-600">{message}</p>}
            <button
              type="button"
              onClick={signOut}
              className="w-full rounded px-2 py-1.5 text-left text-rose-600 hover:bg-rose-50"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
