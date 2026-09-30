import { createClient } from "@/lib/supabase/server";
import { DailyTasks } from "@/components/admin/DailyTasks";
import type { Profile, RecurringTask } from "@/lib/types";

export default async function AdminDailyPage() {
  const supabase = await createClient();
  const [tasksRes, profilesRes] = await Promise.all([
    supabase.from("recurring_tasks").select("*").order("created_at"),
    supabase.from("profiles").select("*").eq("active", true).order("sort_order"),
  ]);
  return (
    <DailyTasks
      initial={(tasksRes.data ?? []) as RecurringTask[]}
      profiles={(profilesRes.data ?? []) as Profile[]}
    />
  );
}
