import { Bot, Cog, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LocalTime } from "@/components/list/local-time";
import { statusLabel } from "@/lib/candidate-status";
import type { ActivityEntry } from "@/lib/chat-types";

export const ACTORS: Record<
  ActivityEntry["actor"],
  { label: string; icon: LucideIcon; tone: string }
> = {
  RECRUITER: {
    label: "You",
    icon: UserRound,
    tone: "bg-success-soft text-success-strong",
  },
  AI: { label: "AI", icon: Bot, tone: "bg-brand-soft text-brand-strong" },
  SYSTEM: { label: "System", icon: Cog, tone: "bg-canvas text-muted" },
};

export function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ol className="divide-y divide-line rounded-xl border border-line">
      {entries.map((entry) => {
        const { label, icon: Icon, tone } = ACTORS[entry.actor];

        return (
          <li key={entry.id} className="flex items-start gap-3 p-4">
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone}`}
            >
              <Icon className="size-4" aria-label={label} />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{entry.summary}</p>
              <p className="mt-0.5 text-xs text-muted">
                {entry.job.title}
                {entry.fromStatus && entry.toStatus && (
                  <>
                    {" · "}
                    {statusLabel(entry.fromStatus)} to {statusLabel(entry.toStatus)}
                  </>
                )}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted">
              <LocalTime value={entry.createdAt} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
