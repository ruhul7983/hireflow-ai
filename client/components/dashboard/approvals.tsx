import Link from "next/link";
import { Briefcase, Mail, MessageSquareReply, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import type { Approval } from "@/lib/dashboard-types";

const ICONS: Record<Approval["kind"], LucideIcon> = {
  reply: MessageSquareReply,
  campaign: Mail,
  job: Briefcase,
  candidates: Users,
};

type ApprovalsProps = {
  approvals: Approval[];
  className?: string;
};

export function Approvals({ approvals, className = "" }: ApprovalsProps) {
  return (
    <Panel
      title="Waiting on you"
      description="Nothing is sent until you approve it"
      aside={
        approvals.length > 0 && (
          <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-strong">
            {approvals.length} to review
          </span>
        )
      }
      className={className}
    >
      {approvals.length === 0 ? (
        <p className="text-sm text-muted">You&apos;re all caught up.</p>
      ) : (
        <ul className="space-y-2">
          {approvals.map(({ id, kind, title, job, conversationId }) => {
            const Icon = ICONS[kind];

            return (
              <li key={id}>
                <Link
                  href={`/chat?c=${conversationId}`}
                  className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2.5 transition-colors hover:bg-line focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-brand-strong">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-medium">{title}</span>
                    <span className="block truncate text-xs text-muted">{job}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
