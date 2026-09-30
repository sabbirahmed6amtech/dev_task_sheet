"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatShortDay } from "@/lib/time";
import { STATUSES, type Profile, type Task } from "@/lib/types";

type Hit = Pick<
  Task,
  "id" | "work_date" | "dev_id" | "ticket_id" | "client_name" | "description" | "status" | "origin_date"
>;
type Result = { latest: Hit; first: string; days: number };

const FIELDS = ["ticket_id", "client_name", "description", "notes"];

/**
 * Searches every day's tasks by ticket, client, task or notes. A task carried over
 * several days is one result, showing the latest day and how long it has run.
 */
export function Search({ profiles, today }: { profiles: Profile[]; today: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  // "/" jumps to search, like most web apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, select");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // Characters that would break PostgREST's or=() filter syntax.
    const term = q.replace(/[,()*%"\\]/g, " ").trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    let stale = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, work_date, dev_id, ticket_id, client_name, description, status, origin_date")
        .or(FIELDS.map((f) => `${f}.ilike."*${term}*"`).join(","))
        .order("work_date", { ascending: false })
        .limit(300);
      if (stale) return;

      const groups = new Map<string, Result>();
      for (const t of (data ?? []) as Hit[]) {
        const key = [t.dev_id, t.origin_date, t.ticket_id, t.client_name].join("|");
        const g = groups.get(key);
        if (g) {
          g.first = t.work_date;
          g.days++;
        } else groups.set(key, { latest: t, first: t.work_date, days: 1 });
      }
      setResults([...groups.values()].slice(0, 30));
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q, supabase]);

  const names = useMemo(() => new Map(profiles.map((p) => [p.id, p.name])), [profiles]);

  function go(date: string) {
    setOpen(false);
    input.current?.blur();
    router.push(date === today ? "/" : `/?d=${date}`);
  }

  return (
    <div className="relative w-full sm:w-72">
      <input
        ref={input}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (q) setQ("");
            else e.currentTarget.blur();
          }
          if (e.key === "Enter" && results?.[0]) go(results[0].latest.work_date);
        }}
        placeholder="Search ticket, client, task…  /"
        className="field relative z-30 h-8 bg-neutral-50 pr-7 focus:bg-white [&::-webkit-search-cancel-button]:appearance-none"
      />
      {q && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQ("");
            input.current?.focus();
          }}
          className="absolute top-1/2 right-1.5 z-30 grid size-5 -translate-y-1/2 place-items-center rounded text-[15px] leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          ×
        </button>
      )}

      {open && results && (
        <>
          {/* Closes on an outside click; the input and its clear button sit above it. */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="card absolute left-0 z-30 mt-1 max-h-[70vh] w-[min(560px,calc(100vw-2rem))] overflow-auto py-1">
            {results.length === 0 && (
              <p className="px-3 py-2 text-[12.5px] text-neutral-500">No tasks match “{q.trim()}”.</p>
            )}
            {results.map(({ latest: t, first, days }) => {
              const status = STATUSES.find((s) => s.value === t.status)!;
              const head = [t.ticket_id, t.client_name].filter(Boolean).join(" - ");
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => go(t.work_date)}
                  className="block w-full px-3 py-2 text-left hover:bg-neutral-50"
                >
                  <div className="flex items-baseline gap-2 text-[12px] text-neutral-500">
                    <span className="font-medium text-neutral-800">{formatShortDay(t.work_date)}</span>
                    {days > 1 && <span>since {formatShortDay(first)} · {days} days</span>}
                    <span className="truncate">· {names.get(t.dev_id) ?? "Former member"}</span>
                    <span className={`ml-auto shrink-0 ${status.className}`}>{status.label}</span>
                  </div>
                  <div className="truncate text-[13px] text-neutral-800">
                    {head && <span className="font-medium">{head}: </span>}
                    {t.description}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
