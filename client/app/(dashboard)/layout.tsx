import { Suspense } from "react";
import { LogoutButton } from "@/components/logout-button";
import { Wordmark } from "@/components/wordmark";
import { requireSessionUser } from "@/lib/auth";

async function Account() {
  const user = await requireSessionUser();

  return (
    <div className="flex min-w-0 items-center gap-4">
      <span className="hidden truncate text-sm opacity-80 sm:block">
        {user.email}
      </span>
      <LogoutButton />
    </div>
  );
}

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 bg-forest px-6 py-4 text-cream">
        <Wordmark />
        <Suspense fallback={null}>
          <Account />
        </Suspense>
      </header>
      {children}
    </div>
  );
}
