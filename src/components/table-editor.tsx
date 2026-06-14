import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TableShape, WeddingTable } from "@/planner/types";
import { clamp, createSeatsForTable } from "@/planner/utils";

export function TableEditor({
  canRemove,
  isOpen,
  onChange,
  onRemove,
  onToggle,
  table,
}: {
  canRemove: boolean;
  isOpen: boolean;
  onChange: (patch: Partial<WeddingTable>) => void;
  onRemove: () => void;
  onToggle: (isOpen: boolean) => void;
  table: WeddingTable;
}) {
  return (
    <details
      className="overflow-hidden rounded-lg border border-[#d8d1c2] bg-[#f7f4ed]"
      open={isOpen}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary className="flex min-h-[42px] cursor-pointer items-center justify-between gap-2.5 px-3 py-[9px] transition-colors marker:hidden hover:bg-white [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 overflow-hidden text-sm font-[780] text-ellipsis whitespace-nowrap">{table.name}</span>
        <div className="flex flex-none items-center gap-2">
          <em className="text-xs not-italic whitespace-nowrap text-[#6f6a60]">{createSeatsForTable(table).length} seats</em>
          <Button
            aria-label={`Remove ${table.name}`}
            className="size-7 rounded-md border-[#d8d1c2] bg-white p-0 text-[#8b2f20] hover:border-[#e4b5aa] hover:bg-[#fff8f5] disabled:text-[#b8b1a5]"
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
            <X aria-hidden="true" />
          </Button>
        </div>
      </summary>
      <div className="grid gap-2.5 border-t border-[#d8d1c2] bg-white p-3">
        <Label className="grid gap-1.5">
          <span className="text-xs font-bold text-[#504b42]">Name</span>
          <Input value={table.name} onChange={(event) => onChange({ name: event.target.value })} />
        </Label>
        <Label className="grid gap-1.5">
          <span className="text-xs font-bold text-[#504b42]">Type</span>
          <Select value={table.shape} onValueChange={(value) => onChange({ shape: value as TableShape })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="round">Round</SelectItem>
              <SelectItem value="rectangular">Rectangular</SelectItem>
            </SelectContent>
          </Select>
        </Label>

        {table.shape === "round" ? (
          <Label className="grid gap-1.5">
            <span className="text-xs font-bold text-[#504b42]">Total seats</span>
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
            <NumberField label="Top" value={table.topSeats} onChange={(topSeats) => onChange({ topSeats })} />
            <NumberField label="Right" value={table.rightSeats} onChange={(rightSeats) => onChange({ rightSeats })} />
            <NumberField label="Bottom" value={table.bottomSeats} onChange={(bottomSeats) => onChange({ bottomSeats })} />
            <NumberField label="Left" value={table.leftSeats} onChange={(leftSeats) => onChange({ leftSeats })} />
          </div>
        )}
      </div>
    </details>
  );
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <Label className="grid gap-1.5">
      <span className="text-xs font-bold text-[#504b42]">{label}</span>
      <Input
        className="min-h-[34px]"
        min={0}
        max={20}
        type="number"
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value), 0, 20))}
      />
    </Label>
  );
}
