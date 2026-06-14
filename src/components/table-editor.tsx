import { Copy, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Messages } from "@/i18n";
import type { TableShape, WeddingTable } from "@/planner/types";
import { clamp, createSeatsForTable } from "@/planner/utils";

export function TableEditor({
  canRemove,
  isOpen,
  onChange,
  onDuplicate,
  onRemove,
  onToggle,
  table,
  t,
}: {
  canRemove: boolean;
  isOpen: boolean;
  onChange: (patch: Partial<WeddingTable>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onToggle: (isOpen: boolean) => void;
  table: WeddingTable;
  t: Messages;
}) {
  return (
    <details
      className="overflow-hidden rounded-lg border border-border bg-accent"
      open={isOpen}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2.5 px-3 py-2.5 transition-colors marker:hidden hover:bg-background">
        <span className="min-w-0 overflow-hidden text-sm font-bold text-ellipsis whitespace-nowrap">{table.name}</span>
        <div className="flex flex-none items-center gap-2">
          <em className="text-xs not-italic whitespace-nowrap text-muted-foreground">
            {t.counts.seats(createSeatsForTable(table, t.seats).length)}
          </em>
          <Button
            aria-label={t.aria.duplicateTable(table.name)}
            className="size-7 rounded-md border-border bg-background p-0"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDuplicate();
            }}
            size="icon"
            title={t.aria.duplicateTable(table.name)}
            type="button"
            variant="ghost"
          >
            <Copy aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            aria-label={t.aria.removeTable(table.name)}
            className="size-7 rounded-md border-border bg-background p-0 text-destructive hover:border-destructive/30 hover:bg-destructive-muted disabled:text-muted-foreground"
            disabled={!canRemove}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
      </summary>
      <div className="grid gap-2.5 border-t border-border bg-background p-3">
        <Label className="grid gap-1.5">
          <span className="text-xs font-bold text-foreground/80">{t.fields.name}</span>
          <Input value={table.name} onChange={(event) => onChange({ name: event.target.value })} />
        </Label>
        <Label className="grid gap-1.5">
          <span className="text-xs font-bold text-foreground/80">{t.fields.type}</span>
          <Select value={table.shape} onValueChange={(value) => onChange({ shape: value as TableShape })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="round">{t.tableShapes.round}</SelectItem>
              <SelectItem value="rectangular">{t.tableShapes.rectangular}</SelectItem>
            </SelectContent>
          </Select>
        </Label>

        {table.shape === "round" ? (
          <Label className="grid gap-1.5">
            <span className="text-xs font-bold text-foreground/80">{t.fields.totalSeats}</span>
            <Input
              min={1}
              max={24}
              type="number"
              value={table.roundSeats}
              onChange={(event) => onChange({ roundSeats: clamp(Number(event.target.value), 1, 24) })}
            />
          </Label>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <NumberField label={t.seats.top} value={table.topSeats} onChange={(topSeats) => onChange({ topSeats })} />
            <NumberField label={t.seats.right} value={table.rightSeats} onChange={(rightSeats) => onChange({ rightSeats })} />
            <NumberField label={t.seats.bottom} value={table.bottomSeats} onChange={(bottomSeats) => onChange({ bottomSeats })} />
            <NumberField label={t.seats.left} value={table.leftSeats} onChange={(leftSeats) => onChange({ leftSeats })} />
          </div>
        )}
      </div>
    </details>
  );
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <Label className="grid gap-1.5">
      <span className="text-xs font-bold text-foreground/80">{label}</span>
      <Input
        className="min-h-8"
        min={0}
        max={20}
        type="number"
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value), 0, 20))}
      />
    </Label>
  );
}
