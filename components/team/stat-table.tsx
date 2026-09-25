import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatColumn<Row> = {
  label: string;
  value: (row: Row) => ReactNode;
};

const cell = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";
const labelCell = "sticky left-0 bg-secondary-background px-2 py-1.5 text-left whitespace-nowrap";

export function StatTable<Row>({
  title,
  rowLabel,
  rows,
  rowKey,
  rowName,
  columns,
  className,
}: {
  title: string;
  rowLabel: string;
  rows: Row[];
  rowKey: (row: Row) => string | number;
  rowName: (row: Row) => ReactNode;
  columns: StatColumn<Row>[];
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("min-w-0", className)}>
      <CardContent className="flex flex-col gap-2">
        <h3 className="font-heading">{title}</h3>
        {rows.length === 0 ? (
          <p className="text-sm opacity-70">No data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs opacity-70">
                  <th scope="col" className={labelCell}>
                    {rowLabel}
                  </th>
                  {columns.map((column) => (
                    <th key={column.label} scope="col" className={cell}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={rowKey(row)} className="border-t-2 border-border">
                    <th scope="row" className={cn(labelCell, "font-heading")}>
                      {rowName(row)}
                    </th>
                    {columns.map((column) => (
                      <td key={column.label} className={cell}>
                        {column.value(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
