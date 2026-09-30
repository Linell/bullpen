import type { ReactNode } from "react";
import { Abbr } from "@/components/ui/abbr";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GlossaryTerm } from "@/lib/glossary";
import { cn } from "@/lib/utils";

export type StatColumn<Row> = {
  label: GlossaryTerm;
  value: (row: Row) => ReactNode;
  align?: "left";
};

type StatGridProps<Row> = {
  rowLabel: string;
  rows: Row[];
  rowKey: (row: Row, index: number) => string | number;
  rowName: (row: Row, index: number) => ReactNode;
  columns: StatColumn<Row>[];
  isHighlighted?: (row: Row) => boolean;
};

const cell = "h-auto px-2 py-1.5 text-right";
const leftCell = "text-left";
const labelCell = "sticky left-0 h-auto bg-background px-2 py-1.5 text-left font-heading";
const bodyRow = "border-b-2 border-border";
const highlighted = "bg-main text-main-foreground";

export function StatGrid<Row>({ rowLabel, rows, rowKey, rowName, columns, isHighlighted }: StatGridProps<Row>) {
  if (rows.length === 0) return <p className="text-sm opacity-70">No data yet.</p>;

  return (
    <Table className="bg-background font-base tabular-nums whitespace-nowrap">
      <TableHeader>
        <TableRow className="text-xs">
          <TableHead scope="col" className={labelCell}>
            {rowLabel}
          </TableHead>
          {columns.map((column) => (
            <TableHead key={column.label} scope="col" className={cn(cell, column.align && leftCell)}>
              <Abbr term={column.label} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="text-right [&_td]:px-2 [&_td]:py-1.5">
        {rows.map((row, index) => {
          const isRowHighlighted = isHighlighted?.(row) ?? false;
          return (
            <tr key={rowKey(row, index)} className={cn(bodyRow, isRowHighlighted && highlighted)}>
              <th scope="row" className={cn(labelCell, isRowHighlighted && highlighted)}>
                {rowName(row, index)}
              </th>
              {columns.map((column) => (
                <td key={column.label} className={column.align && leftCell}>
                  {column.value(row)}
                </td>
              ))}
            </tr>
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
