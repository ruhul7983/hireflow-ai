import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Approvals } from "@/components/dashboard/approvals";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { JobsTable } from "@/components/dashboard/jobs-table";
import { OutreachChart } from "@/components/dashboard/outreach-chart";
import { ReplyOutcomes } from "@/components/dashboard/reply-outcomes";
import { StatCards } from "@/components/dashboard/stat-cards";
import { requireSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard | HireFlow AI",
};

async function Welcome() {
  const user = await requireSessionUser();

  return (
    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
      Welcome back, {user.name ?? user.email}
    </h1>
  );
}

export default function Home() {
  return (
    <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Suspense fallback={<div className="h-9" />}>
            <Welcome />
          </Suspense>
          <p className="mt-0.5 text-muted">
            Here&apos;s how your hiring went over the last 8 weeks.
          </p>
        </div>
        <p className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
          Demo data
        </p>
      </header>

      <StatCards />

      <div className="grid gap-4 xl:grid-cols-12">
        <OutreachChart className="xl:col-span-8" />
        <FunnelChart className="xl:col-span-4" />
        <JobsTable className="xl:col-span-8" />
        <ReplyOutcomes className="xl:col-span-4" />
        <ActivityFeed className="xl:col-span-8" />
        <Approvals className="xl:col-span-4" />
      </div>
    </main>
  );
}
