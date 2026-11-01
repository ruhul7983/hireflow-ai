import type { ReactNode } from "react";

export const tableCell = "px-4 py-3";
export const numericCell = `${tableCell} text-right tabular-nums`;
export const tableRow = "border-t border-line align-top hover:bg-canvas";
export const tableLink = "text-brand-strong hover:underline";

type Column = { label: string; numeric?: boolean };

type DataTableProps = {
  caption: string;
  columns: Column[];
  className: string;
  children: ReactNode;
};

export function DataTable({
  caption,
  columns,
  className,
  children,
}: DataTableProps) {
  return (
    // Scrolls inside the frame so a narrow screen never scrolls the page sideways
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className={`w-full text-sm ${className}`}>
        <caption className="sr-only">{caption}</caption>
        <thead className="text-left text-muted">
          <tr>
            {columns.map(({ label, numeric }) => (
              <th
                key={label}
                scope="col"
                className={`px-4 py-2.5 font-medium whitespace-nowrap ${
                  numeric ? "text-right" : ""
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tone}`}
    >
      {label}
    </span>
  );
}
