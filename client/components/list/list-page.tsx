import type { ReactNode } from "react";
import { SkeletonBlock } from "@/components/dashboard/dashboard-skeleton";

const SKELETON_ROWS = 8;

type ListPageProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function ListPage({ title, description, children }: ListPageProps) {
  return (
    <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-0.5 text-muted">{description}</p>
      </header>
      {children}
    </main>
  );
}

export function ListError({ noun }: { noun: string }) {
  return (
    <p role="alert" className="text-sm font-medium text-danger-strong">
      We couldn&apos;t load your {noun}. Please refresh the page.
    </p>
  );
}

// Matches the toolbar, rows and paginator, so nothing jumps when the list arrives
export function ListSkeleton({ noun }: { noun: string }) {
  return (
    <div role="status" aria-label={`Loading your ${noun}`} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <SkeletonBlock className="h-10 min-w-52 flex-1 rounded-lg sm:max-w-sm" />
        <SkeletonBlock className="h-10 w-40 rounded-lg" />
      </div>

      <div className="rounded-xl border border-line">
        <div className="p-4">
          <SkeletonBlock className="h-4 w-1/3" />
        </div>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-t border-line p-4"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-52 max-w-full" />
              <SkeletonBlock className="h-3 w-36 max-w-full" />
            </div>
            <SkeletonBlock className="h-6 w-20 rounded-full" />
            <SkeletonBlock className="hidden h-4 w-24 md:block" />
            <SkeletonBlock className="hidden h-4 w-24 lg:block" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonBlock className="h-9 w-56 rounded-lg" />
      </div>
    </div>
  );
}
