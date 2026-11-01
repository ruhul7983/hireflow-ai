"use client";

import { useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Panel } from "@/components/dashboard/panel";
import { weekLabel } from "@/lib/dashboard-format";
import type { WeekCounts } from "@/lib/dashboard-types";

const AXIS_STEPS = 4;

const SERIES = [
  { key: "contacted", label: "Contacted", color: "var(--color-muted)" },
  { key: "replied", label: "Replies", color: "var(--color-brand)" },
] as const;

function Legend() {
  return (
    <ul className="flex gap-4 text-sm text-muted">
      {SERIES.map(({ label, color }) => (
        <li key={label} className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ background: color }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}

type OutreachChartProps = {
  weeks: WeekCounts[];
  className?: string;
};

export function OutreachChart({ weeks, className = "" }: OutreachChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const lastIndex = weeks.length - 1;

  // Rounds up so the axis labels stay whole numbers at any volume
  const largest = Math.max(
    ...weeks.flatMap(({ contacted, replied }) => [contacted, replied]),
    1,
  );
  const axisMax = Math.ceil(largest / AXIS_STEPS) * AXIS_STEPS;
  const axisTicks = Array.from(
    { length: AXIS_STEPS + 1 },
    (_, step) => (axisMax / AXIS_STEPS) * (AXIS_STEPS - step),
  );

  const xAt = (index: number) => (index / lastIndex) * 100;
  const yAt = (value: number) => 100 - (value / axisMax) * 100;

  function linePath(key: (typeof SERIES)[number]["key"]) {
    return weeks
      .map((week, index) => `${index ? "L" : "M"}${xAt(index)} ${yAt(week[key])}`)
      .join(" ");
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - left) / width;
    setActive(Math.min(lastIndex, Math.max(0, Math.round(ratio * lastIndex))));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    setActive((current) =>
      Math.min(lastIndex, Math.max(0, (current ?? lastIndex) + step)),
    );
  }

  const activeWeek = active === null ? null : weeks[active];

  return (
    <Panel
      title="Outreach performance"
      description="Candidates contacted and replies received, per week"
      aside={<Legend />}
      className={className}
    >
      <div className="flex gap-3">
        <div
          aria-hidden
          className="relative h-64 w-5 shrink-0 text-right text-xs text-muted"
        >
          {axisTicks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${yAt(tick)}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 pr-5">
          <div
            role="img"
            tabIndex={0}
            aria-label="Line chart of candidates contacted and replies per week. Use the left and right arrow keys to read each week."
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setActive(null)}
            onKeyDown={handleKeyDown}
            onFocus={() => setActive(lastIndex)}
            onBlur={() => setActive(null)}
            className="relative h-64 rounded outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {axisTicks.map((tick) => (
              <span
                key={tick}
                aria-hidden
                className="absolute inset-x-0 h-px bg-line"
                style={{ top: `${yAt(tick)}%` }}
              />
            ))}

            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
            >
              <path
                d={`${linePath("replied")} L100 100 L0 100 Z`}
                fill="var(--color-brand-soft)"
              />
              {SERIES.map(({ key, color }) => (
                <path
                  key={key}
                  d={linePath(key)}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {SERIES.map(({ key }) => (
              <span
                key={key}
                aria-hidden
                className="absolute left-full ml-2 -translate-y-1/2 text-xs font-semibold"
                style={{ top: `${yAt(weeks[lastIndex][key])}%` }}
              >
                {weeks[lastIndex][key]}
              </span>
            ))}

            {activeWeek && active !== null && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 w-px bg-muted/40"
                  style={{ left: `${xAt(active)}%` }}
                />
                {SERIES.map(({ key, color }) => (
                  <span
                    key={key}
                    aria-hidden
                    className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                    style={{
                      left: `${xAt(active)}%`,
                      top: `${yAt(activeWeek[key])}%`,
                      background: color,
                    }}
                  />
                ))}
                <div
                  aria-live="polite"
                  className={`pointer-events-none absolute top-1 z-10 rounded-lg bg-ink px-3 py-2 text-xs whitespace-nowrap text-white ${
                    active > lastIndex / 2 ? "-translate-x-full -ml-3" : "ml-3"
                  }`}
                  style={{ left: `${xAt(active)}%` }}
                >
                  <p className="font-semibold">
                    Week of {weekLabel(activeWeek.weekStart)}
                  </p>
                  {SERIES.map(({ key, label }) => (
                    <p key={key} className="mt-0.5 text-white/85">
                      {label}: {activeWeek[key]}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>

          <div aria-hidden className="relative mt-2 h-4 text-xs text-muted">
            {weeks.map(({ weekStart }, index) => (
              <span
                key={weekStart}
                className={`absolute -translate-x-1/2 whitespace-nowrap ${
                  index % 2 ? "hidden md:block" : ""
                }`}
                style={{ left: `${xAt(index)}%` }}
              >
                {weekLabel(weekStart)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
