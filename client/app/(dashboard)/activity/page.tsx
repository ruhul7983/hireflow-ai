import type { Metadata } from "next";
import { ActivityLog } from "@/components/activity/activity-log";

export const metadata: Metadata = {
  title: "Activity | HireFlow AI",
};

export default function ActivityPage() {
  return (
    <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Activity
        </h1>
        <p className="mt-0.5 text-muted">
          Every change across your jobs, newest first.
        </p>
      </header>
      <ActivityLog />
    </main>
  );
}
