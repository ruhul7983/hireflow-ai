import { Panel } from "@/components/dashboard/panel";
import { formatPercentage, jobs, percentage } from "@/lib/demo-dashboard";
import type { DemoJob } from "@/lib/demo-dashboard";

const NUMERIC_COLUMNS = [
  "Candidates",
  "Reply rate",
  "Interested",
  "Meetings",
  "Hires",
];

const PHASE_TONES: Record<DemoJob["phase"], string> = {
  Sourcing: "bg-warning-soft text-warning-strong",
  Outreach: "bg-brand-soft text-brand-strong",
  Interviewing: "bg-success-soft text-success-strong",
};

export function JobsTable({ className = "" }: { className?: string }) {
  return (
    <Panel
      title="Jobs"
      description="Progress for every open role"
      className={className}
    >
      {/* Scrolls inside the panel so a narrow screen never scrolls the page sideways */}
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-2xl text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th scope="col" className="pb-2.5 font-medium">
                Job
              </th>
              <th scope="col" className="pb-2.5 font-medium">
                Phase
              </th>
              {NUMERIC_COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="pb-2.5 pl-4 text-right font-medium"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map(({ id, title, location, phase, funnel }) => (
              <tr
                key={id}
                className="border-b border-line last:border-0 hover:bg-canvas"
              >
                <th scope="row" className="py-3 pr-4 text-left font-semibold">
                  {title}
                  <span className="block text-xs font-normal text-muted">
                    {location}
                  </span>
                </th>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PHASE_TONES[phase]}`}
                  >
                    {phase}
                  </span>
                </td>
                <td className="py-3 pl-4 text-right tabular-nums">
                  {funnel.sourced}
                </td>
                <td className="py-3 pl-4 text-right tabular-nums">
                  {formatPercentage(
                    percentage(funnel.replied, funnel.contacted),
                  )}
                </td>
                <td className="py-3 pl-4 text-right tabular-nums">
                  {formatPercentage(
                    percentage(funnel.interested, funnel.replied),
                  )}
                </td>
                <td className="py-3 pl-4 text-right tabular-nums">
                  {funnel.meetings}
                </td>
                <td className="py-3 pl-4 text-right tabular-nums">
                  {funnel.hired}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
