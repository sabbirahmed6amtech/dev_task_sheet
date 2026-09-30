import { createClient } from "@/lib/supabase/server";
import { Users } from "@/components/admin/Users";
import type { Profile } from "@/lib/types";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const [{ data }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("*").order("sort_order"),
    supabase.auth.getUser(),
  ]);
  return <Users initial={(data ?? []) as Profile[]} meId={auth.user?.id ?? ""} />;
}
