"use client";

import { useState } from "react";
import { NoteCell, SelectCell, TextCell, TimeCell } from "./Cells";
import { formatShortDay } from "@/lib/time";
import { parsePastedTasks, statusPatch, type ParsedTask } from "@/lib/taskText";
import {
  PRIORITIES,
  PRIORITY_CLASS,
  PRIORITY_DEFAULT_CLASS,
  STATUSES,
  ticketUrl,
  type Task,
  type TaskPatch,
} from "@/lib/types";

const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: `P${p}` }));
const URL_RE = /https?:\/\/\S+/;

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function TaskRow({
  task,
  date,
  devName,
  merge,
  row,
  nextPriority,
  onChange,
  onPasteTasks,
  sharedWith,
  draft,
  onDelete,
}: {
  /** null for the empty entry row at the end of each dev's block. */
  task: Task | null;
  date: string;
  devName: string;
  /**
   * Set on the dev's first row only: their serial number, and how many rows their
   * block has. The SL and Dev cells are merged down the whole block, like the sheet.
   */
  merge: { sl: number; rows: number } | null;
  row: number;
  nextPriority: number;
  onChange: (patch: TaskPatch) => void;
  /** A paste of task lines ("Task 3: 13630 - Client: task") into the description. */
  onPasteTasks: (tasks: ParsedTask[]) => void;
  /** Other devs with this ticket on the same day. */
  sharedWith: Shared[];
  /** The entry row's priority/status/times picked before any text; saved with the first text. */
  draft?: TaskPatch;
  onDelete?: () => void;
}) {
  const ghost = task === null;
  const status = STATUSES.find((s) => s.value === (task?.status ?? draft?.status ?? "not_started"))!;
  const priority = task?.priority ?? draft?.priority ?? nextPriority;
  const startedAt = task ? task.started_at : (draft?.started_at ?? null);
  const endedAt = task ? task.ended_at : (draft?.ended_at ?? null);
  const carriedDays = task && task.origin_date < date ? daysBetween(task.origin_date, date) : 0;
  const descUrl = task?.description?.match(URL_RE)?.[0];
  // The entry row's defaults only appear once you're on it, so empty rows don't read as real tasks.
  const ghostOnly = ghost && !draft ? "invisible group-hover:visible group-focus-within:visible" : "";
  const text = (key: "ticket_id" | "client_name" | "description" | "notes") => (v: string | null) =>
    onChange({ [key]: v });

  return (
    <tr className="group hover:bg-black/[0.025] [&>td]:border-b [&>td]:border-sheet-line/60">
      {/* SL and Dev stay pinned while the sheet scrolls sideways (phones, narrow windows). */}
      {merge && (
        <>
          <td
            rowSpan={merge.rows}
            className="sticky left-0 z-[1] bg-(--band) text-center align-middle text-[13px] font-bold text-neutral-700"
          >
            {merge.sl}
          </td>
          <td
            rowSpan={merge.rows}
            className="sticky left-10 z-[1] bg-(--band) px-2.5 text-center align-middle text-[13px] font-semibold leading-snug text-neutral-800 shadow-[inset_-1px_0_0_var(--color-sheet-line)]"
          >
            {devName}
          </td>
        </>
      )}
      <td className="border-r border-sheet-line/60">
        <div className="flex items-center">
          <TextCell
            row={row}
            col="ticket"
            value={task?.ticket_id ?? null}
            onCommit={text("ticket_id")}
            className="pr-1 tabular-nums"
          />
          {sharedWith.length > 0 && (
            <ClickTip
              label={`Also on this ticket: ${sharedWith.map((s) => s.name).join(", ")}`}
              button={`+${sharedWith.length}`}
              className="h-[18px] rounded bg-sheet-head/10 px-1 text-[10.5px] font-semibold text-sheet-head hover:bg-sheet-head/20"
            >
              <span className="mb-0.5 block text-neutral-400">Also on this ticket</span>
              {sharedWith.map((s) => (
                <span key={s.name} className="block">
                  {s.name} —{" "}
                  {STATUSES.filter((x) => s.statuses.includes(x.value)).map((x) => x.label).join(", ")}
                </span>
              ))}
            </ClickTip>
          )}
          {task?.ticket_id && (
            <a
              href={ticketUrl(task.ticket_id)}
              target="_blank"
              rel="noreferrer"
              tabIndex={-1}
              title="Open support ticket"
              className="grid shrink-0 place-items-center px-1.5 text-blue-700 hover:text-blue-900"
            >
              <ExternalIcon />
            </a>
          )}
        </div>
      </td>
      <td className="border-r border-sheet-line/60">
        <TextCell row={row} col="client" value={task?.client_name ?? null} onCommit={text("client_name")} />
      </td>
      <td className="border-r border-sheet-line/60">
        <div className="flex items-center">
          {task?.recurring_id && <DailyIcon />}
          {carriedDays > 0 && <CarriedIcon since={task!.origin_date} days={carriedDays} />}
          <TextCell
            row={row}
            col="desc"
            value={task?.description ?? null}
            onCommit={text("description")}
            onPaste={(pasted) => {
              const parsed = parsePastedTasks(pasted);
              if (!parsed) return null;
              onPasteTasks(parsed);
              return parsed[0].description;
            }}
            placeholder={ghost ? "+ Add a task" : undefined}
          />
          {descUrl && (
            <a
              href={descUrl}
              target="_blank"
              rel="noreferrer"
              tabIndex={-1}
              title={descUrl}
              className="shrink-0 px-1.5 text-blue-700 hover:text-blue-900"
            >
              <ExternalIcon />
            </a>
          )}
        </div>
      </td>
      <td className="border-r border-sheet-line/60">
        <SelectCell
          row={row}
          col="priority"
          value={priority}
          options={PRIORITY_OPTIONS}
          onChange={(p) => onChange({ priority: p })}
          className={`${PRIORITY_CLASS[priority] ?? PRIORITY_DEFAULT_CLASS} ${ghostOnly}`}
        />
      </td>
      <td className="border-r border-sheet-line/60">
        <SelectCell
          row={row}
          col="status"
          value={status.value}
          options={STATUSES}
          onChange={(s) => onChange(statusPatch(task ?? { started_at: startedAt }, s))}
          className={`${status.className} ${ghostOnly}`}
        />
      </td>
      <td className="border-r border-sheet-line/60">
        <TimeCell row={row} col="start" date={date} value={startedAt} onCommit={(v) => onChange({ started_at: v })} />
      </td>
      <td className="border-r border-sheet-line/60">
        <TimeCell row={row} col="end" date={date} value={endedAt} onCommit={(v) => onChange({ ended_at: v })} />
      </td>
      <td className="border-r border-sheet-line/60">
        <NoteCell
          row={row}
          col="notes"
          value={task?.notes ?? null}
          onCommit={text("notes")}
          className={ghostOnly}
        />
      </td>
      <td className="text-center">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete task"
            className="invisible rounded px-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 group-hover:visible"
          >
            ×
          </button>
        )}
      </td>
    </tr>
  );
}

export type Shared = { name: string; statuses: Task["status"][] };

/** A small button that shows a dark tooltip on click; clicking elsewhere closes it. */
function ClickTip({
  label,
  button,
  className,
  children,
}: {
  label: string;
  button: React.ReactNode;
  className: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative ml-1 shrink-0">
      <button
        type="button"
        tabIndex={-1}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className={className}
      >
        {button}
      </button>
      {open && (
        <span className="absolute top-full left-0 z-20 mt-1 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-[11.5px] leading-5 text-white shadow-lg">
          {children}
        </span>
      )}
    </span>
  );
}

/** Marks a task an admin set up to be added every day. */
function DailyIcon() {
  return (
    <ClickTip
      label="Daily task"
      className="ml-1 grid size-5 place-items-center rounded text-neutral-400 hover:bg-black/5"
      button={
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      }
    >
      Daily task — added automatically by an admin
    </ClickTip>
  );
}

/** Marks a task carried over from an earlier day; click it to see since when. */
function CarriedIcon({ since, days }: { since: string; days: number }) {
  return (
    <ClickTip
      label={`Carried over since ${formatShortDay(since)}`}
      className={`ml-1 grid size-5 place-items-center rounded hover:bg-black/5 ${
        days >= 3 ? "text-rose-600" : "text-neutral-400"
      }`}
      button={
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
        </svg>
      }
    >
      Carried over since {formatShortDay(since)} · {days} {days === 1 ? "day" : "days"}
    </ClickTip>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}
