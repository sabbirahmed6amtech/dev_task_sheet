# Dev Task Sheet

The team's daily task sheet as a web app. One page that looks and works like the
Google Sheet, with each day kept as its own history.

## The sheet

- **Same columns as the Google Sheet.** SL · Dev · Ticket ID · Client Name · Task Description · Priority · Status · Start Time · End Time · Note. Each dev's name is merged down their block, and your own block is always at the top.
- **Edit in place.** Click a cell and type. Changes save when you leave the cell. Enter / Shift+Enter moves down / up, and Esc cancels.
- **Add a task** by typing in the "+ Add a task" row at the bottom of any dev's block. A priority or status alone doesn't create a task; it saves once the row has some text.
- **Paste task lines.** Pasting `Task 3: 13630 - Client Name: Check client concern` into a description fills the ticket, client, task and priority P3. Several lines paste as several tasks.
- **Status stamps the time.** In progress → start time, Paused / Completed → end time. Time cells can also be clicked to edit, set with **Now**, or stamped with **Ctrl+Shift+;**.
- **Notes** work like Google Sheets comments: a filled icon means there's a note (hover to read, click to edit).
- **Ticket ID links** to `support.6amtech.com/agent/search?text=<id>`. When the same ticket is on more than one dev's rows that day, it shows **+N**; click it to see who else is on it.
- **Carry-over.** The first time anyone opens a new day, every unfinished task from the last working day is copied onto it with a ↻ icon (click it for the date it was first added; it turns red after 3 days). The previous day stays exactly as it was.
- **Copy EOD** copies your end-of-day report for the day you're viewing:
  ```
  28 September
  52242 - Manuel Estevez camilo: Check client concern — Completed
  ```
- **Search** (press `/`) finds a ticket, client, task or note across every day.
- **Day history.** Use ‹ › or click the date to open any past day.
- **Live.** When several people have the sheet open, everyone sees each other's edits.

## Admin

Admins get an **Admin** button in the header.

- **Dashboard** — today's totals and what each dev is working on right now. Updates live.
- **Users** — add members, edit names and emails, reset passwords, make someone an admin, set the sheet order, and deactivate people who leave (they can't sign in; their past tasks stay).
- **Daily tasks** — tasks added automatically to the chosen devs' sheets on the chosen weekdays (Sun–Thu by default). They don't carry over; each day gets a fresh one.

Every admin action is checked in the database, not just hidden in the UI.

## Setup

1. Create a new Supabase project. Keep it separate from the Publish Tracker.
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
3. `cp .env.example .env.local` and fill in the project URL and publishable (anon) key from **Project Settings → API**.
4. Create the first account in **Authentication → Users → Add user**, then make it an admin in the SQL Editor:
   ```sql
   update public.profiles set is_admin = true where email = 'you@example.com';
   ```
5. `npm install && npm run dev` → http://localhost:3000. Add the rest of the team from **Admin → Users**.

(`npm run create-users` still works for creating many accounts at once from `scripts/users.json`; it needs the service-role key in `.env.local`.)

## Deploy

Vercel works as-is. Set only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` there.
