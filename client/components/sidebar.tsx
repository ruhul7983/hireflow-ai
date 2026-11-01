"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Briefcase,
  LayoutDashboard,
  Mail,
  Menu,
  MessageSquare,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Wordmark } from "@/components/wordmark";

type NavItem = { label: string; icon: LucideIcon; href?: string };

// Items without an href are shown as upcoming, so they can't lead to a 404
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Chat", icon: MessageSquare, href: "/chat" },
  { label: "Jobs", icon: Briefcase },
  { label: "Candidates", icon: Users },
  { label: "Campaigns", icon: Mail },
  { label: "Activity", icon: Activity, href: "/activity" },
];

const itemClass =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium";

export function Sidebar({ account }: { account: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="sidebar"
          className="rounded-md p-2 focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      {open && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
        />
      )}

      {/* invisible keeps the closed drawer out of the tab order on small screens */}
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-[translate,visibility] lg:visible lg:translate-x-0 ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-7">
          <Wordmark />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1 text-muted focus-visible:outline-2 focus-visible:outline-brand lg:hidden"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ label, icon: Icon, href }) => (
              <li key={label}>
                {href ? (
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={pathname === href ? "page" : undefined}
                    className={`${itemClass} transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
                      pathname === href
                        ? "bg-brand-soft text-brand-strong"
                        : "text-muted hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    <Icon className="size-4.5" aria-hidden />
                    {label}
                  </Link>
                ) : (
                  <span aria-disabled className={`${itemClass} text-muted`}>
                    <Icon className="size-4.5" aria-hidden />
                    {label}
                    <span className="ml-auto rounded bg-canvas px-1.5 py-0.5 text-[0.625rem] font-semibold">
                      Soon
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-line p-4">{account}</div>
      </aside>
    </>
  );
}
