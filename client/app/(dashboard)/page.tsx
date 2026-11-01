import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Approvals } from "@/components/dashboard/approvals";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { JobsTable } from "@/components/dashboard/jobs-table";
import { OutreachChart } from "@/components/dashboard/outreach-chart";
import { ReplyOutcomes } from "@/components/dashboard/reply-outcomes";
import { StatCards } from "@/components/dashboard/stat-cards";
import { requireSessionUser } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";

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

async function DashboardContent() {
  const data = await getDashboard();

  if (!data) {
    return (
      <p role="alert" className="text-sm font-medium text-danger-strong">
        We couldn&apos;t load your dashboard. Please refresh the page.
      </p>
    );
  }

  if (data.jobs.length === 0) {
    return (
      <section className="rounded-xl border border-line p-8 text-center">
        <h2 className="text-lg font-semibold tracking-tight">No jobs yet</h2>
        <p className="mt-1 text-sm text-muted">
          Paste a job description in chat, and your numbers will appear here.
        </p>
        <Link
          href="/chat"
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
        >
          Open chat
        </Link>
      </section>
    );
  }

  return (
    <>
      <StatCards data={data} />

      <div className="grid gap-4 xl:grid-cols-12">
        <OutreachChart weeks={data.weeks} className="xl:col-span-8" />
        <FunnelChart
          stages={data.stages}
          exits={data.exits}
          className="xl:col-span-4"
        />
        <JobsTable jobs={data.jobs} className="xl:col-span-8" />
        <ReplyOutcomes outcomes={data.replyOutcomes} className="xl:col-span-4" />
        <ActivityFeed activity={data.activity} className="xl:col-span-8" />
        <Approvals approvals={data.approvals} className="xl:col-span-4" />
      </div>
    </>
  );
}

export default function Home() {
  return (
    <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Suspense fallback={<div className="h-9" />}>
          <Welcome />
        </Suspense>
        <p className="mt-0.5 text-muted">
          Here&apos;s how your hiring is going.
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-muted">Loading your numbers…</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
