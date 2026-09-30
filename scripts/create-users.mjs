// Creates the team's accounts from scripts/users.json. Order in the file is the
// order devs appear on the sheet. Safe to re-run: existing emails are skipped.
//
//   npm run create-users

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PASSWORD = "12345678";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const users = JSON.parse(readFileSync(new URL("./users.json", import.meta.url), "utf8"));

for (const [i, user] of users.entries()) {
  if (!user.email) {
    console.warn(`skip   ${user.name} — no email in users.json`);
    continue;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: user.name, sort_order: i + 1 },
  });

  if (!error) console.log(`added  ${user.name} <${user.email}>`);
  else if (/already/i.test(error.message)) console.log(`exists ${user.name} <${user.email}>`);
  else console.error(`error  ${user.name}: ${error.message}`);
}
