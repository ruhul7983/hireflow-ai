import { Suspense } from "react";
import { LogoutButton } from "@/components/logout-button";
import { Sidebar } from "@/components/sidebar";
import { requireSessionUser } from "@/lib/auth";

async function Account() {
  const user = await requireSessionUser();
  const displayName = user.name ?? user.email;

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white"
        >
          {displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
      </div>
      <LogoutButton />
    </div>
  );
}

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:pl-64">
      <Sidebar
        account={
          <Suspense fallback={null}>
            <Account />
          </Suspense>
        }
      />
      {children}
    </div>
  );
}
