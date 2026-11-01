import type { CSSProperties, ReactNode } from "react";

const STAT_CARDS = 6;
const FUNNEL_ROWS = 9;
const TABLE_ROWS = 4;
const ACTIVITY_ROWS = 4;

// Weekly bar heights, so the chart placeholder doesn't read as a flat block
const CHART_BARS = ["35%", "55%", "45%", "70%", "60%", "85%", "75%", "90%"];

export function SkeletonBlock({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={`animate-pulse rounded-md bg-line motion-reduce:animate-none ${className}`}
    />
  );
}

function SkeletonPanel({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-line p-5 ${className}`}>
      <SkeletonBlock className="h-5 w-40" />
      <SkeletonBlock className="mt-2 h-4 w-56 max-w-full" />
      <div className="mt-5">{children}</div>
    </div>
  );
}

export function WelcomeSkeleton() {
  return <SkeletonBlock className="h-8 w-64 max-w-full sm:h-9" />;
}

// Matches the real layout, so the page doesn't jump when the numbers arrive
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: STAT_CARDS }, (_, index) => (
          <div key={index} className="rounded-xl border border-line p-4">
            <div className="flex items-center justify-between gap-2">
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="size-8 rounded-lg" />
            </div>
            <SkeletonBlock className="mt-3 h-8 w-16" />
            <SkeletonBlock className="mt-4 h-8 w-full" />
            <SkeletonBlock className="mt-3 h-3 w-28 max-w-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <SkeletonPanel className="xl:col-span-8">
          <div className="flex h-64 items-end gap-3">
            {CHART_BARS.map((height, index) => (
              <SkeletonBlock
                key={index}
                className="flex-1 rounded-b-none"
                style={{ height }}
              />
            ))}
          </div>
        </SkeletonPanel>

        <SkeletonPanel className="xl:col-span-4">
          <div className="space-y-2.5">
            {Array.from({ length: FUNNEL_ROWS }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <SkeletonBlock className="h-4 w-24 shrink-0" />
                <SkeletonBlock className="h-5 flex-1" />
              </div>
            ))}
          </div>
        </SkeletonPanel>

        <SkeletonPanel className="xl:col-span-8">
          <div className="space-y-4">
            {Array.from({ length: TABLE_ROWS }, (_, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-48 max-w-full" />
                  <SkeletonBlock className="h-3 w-32 max-w-full" />
                </div>
                <SkeletonBlock className="h-6 w-20 rounded-full" />
                <SkeletonBlock className="hidden h-4 w-40 md:block" />
              </div>
            ))}
          </div>
        </SkeletonPanel>

        <SkeletonPanel className="xl:col-span-4">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <SkeletonBlock className="size-36 rounded-full" />
            <div className="min-w-44 flex-1 space-y-2.5">
              {Array.from({ length: 5 }, (_, index) => (
                <SkeletonBlock key={index} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </SkeletonPanel>

        <SkeletonPanel className="xl:col-span-8">
          <div className="space-y-4">
            {Array.from({ length: ACTIVITY_ROWS }, (_, index) => (
              <div key={index} className="flex gap-3">
                <SkeletonBlock className="size-8 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-3/4" />
                  <SkeletonBlock className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonPanel>

        <SkeletonPanel className="xl:col-span-4">
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <SkeletonBlock key={index} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </SkeletonPanel>
      </div>
    </div>
  );
}
