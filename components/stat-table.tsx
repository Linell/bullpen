import type { ReactNode } from "react";
import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GlossaryTerm } from "@/lib/glossary";
import { cn } from "@/lib/utils";

export type StatColumn<Row> = {
  label: GlossaryTerm;
  value: (row: Row) => ReactNode;
};

type StatGridProps<Row> = {
  rowLabel: string;
  rows: Row[];
  rowKey: (row: Row) => string | number;
  rowName: (row: Row) => ReactNode;
  columns: StatColumn<Row>[];
  isHighlighted?: (row: Row) => boolean;
};

const cell = "h-auto px-2 py-1.5 text-right tabular-nums whitespace-nowrap";
const labelCell = "sticky left-0 h-auto bg-background px-2 py-1.5 whitespace-nowrap";
const highlighted = "bg-main text-main-foreground";

export function StatGrid<Row>({ rowLabel, rows, rowKey, rowName, columns, isHighlighted }: StatGridProps<Row>) {
  if (rows.length === 0) return <p className="text-sm opacity-70">No data yet.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow className="text-xs">
          <TableHead scope="col" className={labelCell}>
            {rowLabel}
          </TableHead>
          {columns.map((column) => (
            <TableHead key={column.label} scope="col" className={cell}>
              <Abbr term={column.label} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const isRowHighlighted = isHighlighted?.(row) ?? false;
          return (
            <TableRow key={rowKey(row)} className={cn(isRowHighlighted && highlighted)}>
              <TableHead scope="row" className={cn(labelCell, isRowHighlighted && highlighted)}>
                {rowName(row)}
              </TableHead>
              {columns.map((column) => (
                <TableCell key={column.label} className={cell}>
                  {column.value(row)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function StatTable<Row>({
  title,
  className,
  ...grid
}: StatGridProps<Row> & { title: string; className?: string }) {
  return (
    <Card size="sm" className={cn("min-w-0", className)}>
      <CardContent className="flex flex-col gap-2">
        <h3 className="font-heading">{title}</h3>
        <StatGrid {...grid} />
      </CardContent>
    </Card>
  );
}
