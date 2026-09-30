"use client";

import { useEffect, useRef, useState } from "react";
import { dateOf, formatClock, formatShortDay, fromTimeInput, toTimeInput } from "@/lib/time";

type NavProps = { row: number; col: string };

/** Enter / Shift+Enter moves to the same column in the next / previous row, like a sheet. */
function moveFocus(from: HTMLElement, delta: number) {
  const row = Number(from.dataset.row) + delta;
  const next = document.querySelector<HTMLElement>(
    `[data-row="${row}"][data-col="${from.dataset.col}"]`,
  );
  if (next) next.focus();
  else from.blur();
}

/**
 * A text cell. Keeps its own draft while focused, so live updates from other
 * people never overwrite what you're typing; saves on blur.
 */
export function TextCell({
  value,
  onCommit,
  onPaste,
  placeholder,
  className = "",
  row,
  col,
}: {
  value: string | null;
  onCommit: (value: string | null) => void;
  /** Handles a paste itself by returning the cell's new text; null lets it paste normally. */
  onPaste?: (text: string) => string | null;
  placeholder?: string;
  className?: string;
} & NavProps) {
  const [draft, setDraft] = useState(value ?? "");
  const focused = useRef(false);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value ?? "");
  }, [value]);

  return (
    <input
      data-row={row}
      data-col={col}
      value={draft}
      title={draft.length > 30 ? draft : undefined}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onPaste={(e) => {
        const next = onPaste?.(e.clipboardData.getData("text"));
        if (next == null) return;
        e.preventDefault();
        setDraft(next);
      }}
      onFocus={() => {
        focused.current = true;
        cancelled.current = false;
      }}
      onBlur={() => {
        focused.current = false;
        if (cancelled.current) {
          setDraft(value ?? "");
          return;
        }
        const next = draft.trim() || null;
        if (next !== (value ?? null)) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          moveFocus(e.currentTarget, e.shiftKey ? -1 : 1);
        } else if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      className={`cell ${className}`}
    />
  );
}

export function SelectCell<T extends string | number>({
  value,
  options,
  onChange,
  className = "",
  row,
  col,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
} & NavProps) {
  return (
    <select
      data-row={row}
      data-col={col}
      value={String(value)}
      onChange={(e) => {
        const picked = options.find((o) => String(o.value) === e.target.value);
        if (picked) onChange(picked.value);
      }}
      className={`cell-select ${className}`}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)} className="text-neutral-800">
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * A time cell. Shows the time like the sheet ("9:10:15 AM"); click to edit.
 * Ctrl+Shift+; stamps the current time, same shortcut as Google Sheets.
 */
export function TimeCell({
  value,
  date,
  onCommit,
  row,
  col,
}: {
  value: string | null;
  /** The sheet day this row belongs to; a time typed in is on this day. */
  date: string;
  onCommit: (value: string | null) => void;
} & NavProps) {
  const [editing, setEditing] = useState(false);
  const stampNow = () => {
    onCommit(new Date().toISOString());
    setEditing(false);
  };
  const isNowShortcut = (e: React.KeyboardEvent) =>
    e.ctrlKey && e.shiftKey && (e.key === ";" || e.key === ":" || e.code === "Semicolon");

  if (editing) {
    return (
      <input
        type="time"
        step={1}
        autoFocus
        data-row={row}
        data-col={col}
        defaultValue={value ? toTimeInput(value) : ""}
        onBlur={(e) => {
          setEditing(false);
          const v = e.target.value;
          const next = v ? fromTimeInput(value ? dateOf(value) : date, v) : null;
          if (next !== value) onCommit(next);
        }}
        onKeyDown={(e) => {
          if (isNowShortcut(e)) {
            e.preventDefault();
            stampNow();
          } else if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        className="cell"
      />
    );
  }

  const otherDay = value && dateOf(value) !== date ? formatShortDay(dateOf(value)) : null;

  return (
    <div className="group/time relative">
      <button
        type="button"
        data-row={row}
        data-col={col}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (isNowShortcut(e)) {
            e.preventDefault();
            stampNow();
          }
        }}
        className="cell text-left tabular-nums"
      >
        {value ? (
          <>
            {otherDay && <span className="mr-1.5 text-[11px] text-neutral-500">{otherDay}</span>}
            {formatClock(value)}
          </>
        ) : null}
      </button>
      {!value && (
        <button
          type="button"
          tabIndex={-1}
          onClick={stampNow}
          title="Set to now (Ctrl+Shift+;)"
          className="absolute inset-y-1 right-1 hidden rounded border border-neutral-300 bg-white px-1.5 text-[10.5px] text-neutral-500 hover:text-neutral-900 group-hover/time:block"
        >
          Now
        </button>
      )}
    </div>
  );
}

const NOTE_BOX_HEIGHT = 190;

/**
 * A note, shown like a Google Sheets comment: the cell is just an icon (filled when
 * there's a note, which shows on hover), and clicking it opens a box to read or edit it.
 */
export function NoteCell({
  value,
  onCommit,
  className = "",
  row,
  col,
}: {
  value: string | null;
  onCommit: (value: string | null) => void;
  className?: string;
} & NavProps) {
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  // Fixed to the viewport, so the sheet's scroll area and rounded corners can't clip it.
  const [pos, setPos] = useState<React.CSSProperties | null>(null);

  function open() {
    const r = button.current!.getBoundingClientRect();
    const below = r.bottom + 4 + NOTE_BOX_HEIGHT <= window.innerHeight;
    setPos({
      right: Math.max(8, window.innerWidth - r.right),
      ...(below ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }),
    });
    setDraft(value ?? "");
  }

  function close(save: boolean) {
    if (save) {
      const next = draft.trim() || null;
      if (next !== (value ?? null)) onCommit(next);
    }
    setPos(null);
    button.current?.focus();
  }

  // Scrolling the sheet would leave the box behind, so save and close instead.
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!pos) return;
    const onScroll = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) closeRef.current(true);
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [pos]);

  return (
    <>
      <button
        ref={button}
        type="button"
        data-row={row}
        data-col={col}
        onClick={open}
        title={value ?? "Add a note"}
        aria-label={value ? `Note: ${value}` : "Add a note"}
        className={`mx-auto grid h-[36px] w-full place-items-center focus:outline-2 focus:-outline-offset-2 focus:outline-sheet-head ${
          value ? "text-amber-500 hover:text-amber-600" : "text-neutral-300 hover:text-neutral-500"
        } ${className}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={value ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
          <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4V5z" />
        </svg>
      </button>

      {pos && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => close(true)} />
          <div ref={box} style={pos} className="card fixed z-50 w-72 p-2.5">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Note</div>
            <textarea
              autoFocus
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.setSelectionRange(draft.length, draft.length)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  close(false);
                } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  close(true);
                }
              }}
              placeholder="Add a note…"
              className="field resize-none leading-5"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">⌘/Ctrl+Enter to save · Esc to cancel</span>
              <button type="button" onClick={() => close(true)} className="btn btn-primary py-1">
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
