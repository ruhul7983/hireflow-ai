import { Mail, MessageSquareReply } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { approvals } from "@/lib/demo-dashboard";

export function Approvals({ className = "" }: { className?: string }) {
  return (
    <Panel
      title="Waiting on you"
      description="Nothing is sent until you approve it"
      aside={
        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-strong">
          {approvals.length} to review
        </span>
      }
      className={className}
    >
      <ul className="space-y-2">
        {approvals.map(({ id, kind, title, job }) => {
          const Icon = kind === "reply" ? MessageSquareReply : Mail;

          return (
            <li
              key={id}
              className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2.5"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-brand-strong">
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">{title}</p>
                <p className="truncate text-xs text-muted">{job}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
