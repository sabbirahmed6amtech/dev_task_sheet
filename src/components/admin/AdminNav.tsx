"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/daily", label: "Daily tasks" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-2.5 sm:px-6">
        <div className="flex items-center gap-2.5 pb-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-sheet-head text-[13px] font-bold text-white">
            T
          </span>
          <span className="text-[15px] font-semibold">Admin</span>
        </div>
        <nav className="flex gap-1 self-end">
          {TABS.map((t) => {
            const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`border-b-2 px-3 pb-2.5 pt-1 text-[13px] font-medium ${
                  active
                    ? "border-sheet-head text-neutral-900"
                    : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/" className="btn ml-auto mb-2.5 border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50">
          ← Task sheet
        </Link>
      </div>
    </header>
  );
}
