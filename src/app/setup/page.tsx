export default function SetupPage() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-md p-6 text-[13px] leading-relaxed text-neutral-700">
        <h1 className="mb-2 text-[15px] font-semibold text-neutral-900">Connect Supabase</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Supabase URL and
          keys, run <code>supabase/schema.sql</code> in the SQL editor, then restart the dev
          server. See the README for the full steps.
        </p>
      </div>
    </div>
  );
}
