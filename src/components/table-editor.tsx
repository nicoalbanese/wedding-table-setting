import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <details className="table-editor" open={isOpen} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>
        <span>{table.name}</span>
        <div className="table-summary-actions">
          <em>{createSeatsForTable(table).length} seats</em>
          <Button
            aria-label={`Remove ${table.name}`}
            className="remove-table-button"
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
      <div className="editor-fields">
        <label className="field">
          <span>Name</span>
          <input value={table.name} onChange={(event) => onChange({ name: event.target.value })} />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={table.shape} onChange={(event) => onChange({ shape: event.target.value as TableShape })}>
            <option value="round">Round</option>
            <option value="rectangular">Rectangular</option>
          </select>
        </label>

        {table.shape === "round" ? (
          <label className="field">
            <span>Total seats</span>
            <input
              min={1}
              max={24}
              type="number"
              value={table.roundSeats}
              onChange={(event) => onChange({ roundSeats: clamp(Number(event.target.value), 1, 24) })}
            />
          </label>
        ) : (
          <div className="side-grid">
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
    <label className="field compact">
      <span>{label}</span>
      <input min={0} max={20} type="number" value={value} onChange={(event) => onChange(clamp(Number(event.target.value), 0, 20))} />
    </label>
  );
}
