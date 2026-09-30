// Turning task lines into rows and back: the "Task 3: 13630 - Client: task" lines
// people paste from chat, and the end-of-day report they post.
import { formatLongDay } from "./time";
import { STATUSES, type Task, type TaskPatch, type TaskStatus } from "./types";

/** Status changes stamp the times, so a row can't be "Completed" without an end time. */
export function statusPatch(task: Pick<Task, "started_at"> | null, status: TaskStatus): TaskPatch {
  const now = new Date().toISOString();
  switch (status) {
    case "in_progress":
      return { status, started_at: task?.started_at ?? now, ended_at: null };
    case "paused":
    case "completed":
      return { status, ended_at: now };
    case "not_started":
      return { status, started_at: null, ended_at: null };
  }
}

/** A row only becomes a task once it has some text; a status or priority alone isn't one. */
export function hasContent(p: TaskPatch) {
  return Boolean(p.ticket_id || p.client_name || p.description || p.notes);
}

export type ParsedTask = {
  priority?: number;
  ticket_id?: string;
  client_name?: string;
  description: string;
  status?: TaskStatus;
};

const TASK_PREFIX = /^task\s*#?\s*(\d+)\s*[:.)-]\s*/i;
const STATUS_SUFFIX = /\s+[—–-]\s+(not started|in progress|paused|completed)\s*$/i;
// "13630 - KOUAKOU Kouassi Fulgence: Check client concern". The client runs to the
// first ": ", so a colon inside the task text stays in the task.
const TICKET_CLIENT = /^#?([A-Za-z]{0,6}-?\d{3,})\s+-\s+(.+?):\s+(.+)$/;

/** One pasted line, or null when it has none of the task-line structure. */
function parseLine(line: string): ParsedTask | null {
  let rest = line.trim();
  const out: Partial<ParsedTask> = {};
  let structured = false;

  const prefix = rest.match(TASK_PREFIX);
  if (prefix) {
    out.priority = Math.min(Math.max(Number(prefix[1]), 1), 10);
    rest = rest.slice(prefix[0].length);
    structured = true;
  }

  const status = rest.match(STATUS_SUFFIX);
  if (status) {
    out.status = STATUSES.find((s) => s.label.toLowerCase() === status[1].toLowerCase())?.value;
    rest = rest.slice(0, status.index).trim();
    structured = true;
  }

  const tc = rest.match(TICKET_CLIENT);
  if (tc) {
    out.ticket_id = tc[1];
    out.client_name = tc[2].trim();
    rest = tc[3].trim();
    structured = true;
  }

  return structured && rest ? { ...out, description: rest } : null;
}

/**
 * Splits pasted text into tasks, one per line. Returns null for ordinary text, so
 * the paste goes into the cell as-is. Once any line looks like a task line, every
 * line becomes a task (plain lines keep just their description).
 */
export function parsePastedTasks(text: string): ParsedTask[] | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parsed = lines.map(parseLine);
  if (!parsed.some(Boolean)) return null;
  return parsed.map((p, i) => p ?? { description: lines[i] });
}

/** "13630 - Client: task", or just the parts that are filled in. */
function taskLine(t: Task) {
  const head = [t.ticket_id, t.client_name].filter(Boolean).join(" - ");
  if (head && t.description) return `${head}: ${t.description}`;
  return head || t.description || "";
}

/** The end-of-day report: the day, then each task with its status, in sheet order. */
export function eodReport(date: string, tasks: Task[]) {
  const lines = tasks
    .filter((t) => t.ticket_id || t.client_name || t.description)
    .sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at))
    .map((t) => `${taskLine(t)} — ${STATUSES.find((s) => s.value === t.status)!.label}`);
  return lines.length ? [formatLongDay(date), ...lines].join("\n") : null;
}
