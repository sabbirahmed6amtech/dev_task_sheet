export type TaskStatus = "not_started" | "in_progress" | "paused" | "completed";

export type Profile = {
  id: string;
  name: string;
  email: string;
  sort_order: number;
  active: boolean;
  is_admin: boolean;
};

export type Task = {
  id: string;
  work_date: string;
  dev_id: string;
  priority: number;
  ticket_id: string | null;
  client_name: string | null;
  description: string | null;
  status: TaskStatus;
  started_at: string | null;
  ended_at: string | null;
  notes: string | null;
  carried_from: string | null;
  origin_date: string;
  created_at: string;
  updated_at?: string;
  /** Set when the task was added automatically from a daily task. */
  recurring_id?: string | null;
};

/** A task an admin set up to be added to chosen devs' sheets on chosen weekdays. */
export type RecurringTask = {
  id: string;
  ticket_id: string | null;
  client_name: string | null;
  description: string;
  priority: number;
  dev_ids: string[];
  /** 0 = Sunday … 6 = Saturday */
  weekdays: number[];
  active: boolean;
  created_at: string;
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type TaskPatch = Partial<
  Pick<
    Task,
    | "priority"
    | "ticket_id"
    | "client_name"
    | "description"
    | "status"
    | "started_at"
    | "ended_at"
    | "notes"
  >
>;

export const STATUSES: { value: TaskStatus; label: string; className: string }[] = [
  { value: "not_started", label: "Not started", className: "text-neutral-500" },
  { value: "in_progress", label: "In progress", className: "font-medium text-amber-700" },
  { value: "paused", label: "Paused", className: "font-medium text-rose-600" },
  { value: "completed", label: "Completed", className: "font-medium text-emerald-700" },
];

export const PRIORITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const PRIORITY_CLASS: Record<number, string> = {
  1: "font-semibold text-neutral-900",
};
export const PRIORITY_DEFAULT_CLASS = "text-neutral-600";

export function ticketUrl(id: string) {
  return `https://support.6amtech.com/agent/search?text=${encodeURIComponent(id.trim())}`;
}
