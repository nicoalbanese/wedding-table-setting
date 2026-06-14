import type { CSSProperties, DragEvent } from "react";

import { DietaryBadges } from "@/components/dietary-badges";
import type { Guest, Seat } from "@/planner/types";

export function SeatButton({
  assignment,
  guest,
  onClear,
  onDrop,
  onOpen,
  seat,
  style,
}: {
  assignment?: string;
  guest?: Guest;
  onClear: (seatId: string) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>, seatId: string) => void;
  onOpen: (seatId: string) => void;
  seat: Seat;
  style?: CSSProperties;
}) {
  return (
    <button
      className={`seat ${guest ? "occupied" : ""}`}
      draggable={Boolean(guest)}
      onClick={() => onOpen(seat.id)}
      onDragOver={(event) => event.preventDefault()}
      onDragStart={(event) => {
        if (!assignment) return;
        event.dataTransfer.setData("application/x-guest-id", assignment);
      }}
      onDrop={(event) => onDrop(event, seat.id)}
      style={style}
      title={guest ? [guest.name, seat.label, guest.dietary].filter(Boolean).join(" - ") : seat.label}
      type="button"
    >
      <span className="seat-name">{guest?.name ?? "+"}</span>
      {guest ? <DietaryBadges dietary={guest.dietary} compact /> : null}
      {guest && (
        <em
          onClick={(event) => {
            event.stopPropagation();
            onClear(seat.id);
          }}
        >
          x
        </em>
      )}
    </button>
  );
}
