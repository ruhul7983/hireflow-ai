import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  description?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Panel({
  title,
  description,
  aside,
  className = "",
  children,
}: PanelProps) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-line bg-surface p-5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          )}
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
