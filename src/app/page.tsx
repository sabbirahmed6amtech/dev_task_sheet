import { createClient } from "@/lib/supabase/server";
import { isISODate, todayISO } from "@/lib/time";
import { TaskSheet } from "@/components/TaskSheet";
import type { Profile, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SheetPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const today = todayISO();
  const date = isISODate(d) && d <= today ? d : today;

  const supabase = await createClient();

  // Opening today for the first time brings over yesterday's unfinished tasks.
  if (date === today) {
    const { error } = await supabase.rpc("ensure_day", { d: date });
    if (error) console.error("ensure_day failed:", error.message);
  }

  const [profilesRes, tasksRes, userRes] = await Promise.all([
    supabase.from("profiles").select("id, name, email, sort_order, active, is_admin").order("sort_order"),
    supabase
      .from("tasks")
      .select("*")
      .eq("work_date", date)
      .order("priority")
      .order("created_at"),
    supabase.auth.getUser(),
  ]);

  const tasks = (tasksRes.data ?? []) as Task[];
  const withTasks = new Set(tasks.map((t) => t.dev_id));
  // Former team members stay off the sheet unless they have tasks that day.
  const profiles = ((profilesRes.data ?? []) as Profile[]).filter(
    (p) => p.active || withTasks.has(p.id),
  );

  const me = profiles.find((p) => p.id === userRes.data.user?.id) ?? null;

  return (
    <TaskSheet
      key={date}
      date={date}
      today={today}
      profiles={profiles}
      initialTasks={tasks}
      me={me}
      loadError={profilesRes.error?.message ?? tasksRes.error?.message ?? null}
    />
  );
}
