import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/time";
import { Dashboard } from "@/components/admin/Dashboard";
import type { Profile, Task } from "@/lib/types";

export default async function AdminDashboardPage() {
  const today = todayISO();
  const supabase = await createClient();

  // Open today if nobody has yet, so the dashboard shows carried and daily tasks.
  await supabase.rpc("ensure_day", { d: today });

  const [profilesRes, tasksRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("active", true).order("sort_order"),
    supabase.from("tasks").select("*").eq("work_date", today),
  ]);

  return (
    <Dashboard
      today={today}
      profiles={(profilesRes.data ?? []) as Profile[]}
      initialTasks={(tasksRes.data ?? []) as Task[]}
    />
  );
}
