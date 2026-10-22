import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode; className?: string; hideOnMobile?: boolean };

/** Table on desktop; rows collapse to a stacked list on phones. */
export function DataTable<T>({ columns, rows, rowHref, rowKey, empty }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; rowHref?: (row: T) => string; empty?: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className="overflow-hidden rounded-xl border border-concrete-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="hidden bg-concrete-50 text-xs uppercase tracking-wide text-ink-500 md:table-header-group">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={cn("px-4 py-2.5 font-semibold", c.className)}>{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-concrete-200">
          {rows.map((row) => {
            const href = rowHref?.(row);
            return (
              <tr key={rowKey(row)} className="relative flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-concrete-50 md:table-row md:p-0">
                {columns.map((c, i) => (
                  <td key={c.key} className={cn("md:px-4 md:py-3", i === 0 ? "w-full font-semibold text-ink md:w-auto" : "text-ink-600", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                    {i === 0 && href ? <Link href={href} className="after:absolute after:inset-0">{c.cell(row)}</Link> : c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
