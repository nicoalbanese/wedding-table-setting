import type { DragEvent } from "react";

import { SeatButton } from "@/components/seat-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Guest, WeddingTable } from "@/planner/types";
import { createSeatsForTable, getRoundSeatStyle } from "@/planner/utils";

export function TableView({
  assignments,
  guestById,
  onClearSeat,
  onClearTable,
  onRename,
  onOpenSeat,
  onSeatDrop,
  table,
}: {
  assignments: Record<string, string>;
  guestById: Map<string, Guest>;
  onClearSeat: (seatId: string) => void;
  onClearTable: () => void;
  onRename: (name: string) => void;
  onOpenSeat: (seatId: string) => void;
  onSeatDrop: (event: DragEvent<HTMLButtonElement>, seatId: string) => void;
  table: WeddingTable;
}) {
  const seats = createSeatsForTable(table);
  const assignedCount = seats.filter((seat) => assignments[seat.id]).length;
  const topSeats = seats.filter((seat) => seat.side === "top");
  const leftSeats = seats.filter((seat) => seat.side === "left");
  const rightSeats = seats.filter((seat) => seat.side === "right");
  const bottomSeats = seats.filter((seat) => seat.side === "bottom");

  return (
    <article className={`table-card ${table.shape}`}>
      <div className="table-title">
        <Input
          aria-label={`Name for ${table.name}`}
          className="table-name-input"
          value={table.name}
          onChange={(event) => onRename(event.target.value)}
        />
        <div className="table-actions">
          <span>
            {assignedCount}/{seats.length}
          </span>
          <Button className="table-reset-button" type="button" variant="destructive" onClick={onClearTable} disabled={assignedCount === 0}>
            Unseat Table
          </Button>
        </div>
      </div>
      {table.shape === "round" ? (
        <div className="round-layout">
          <div className="round-table-label">Round</div>
          {seats.map((seat, index) => (
            <SeatButton
              assignment={assignments[seat.id]}
              guest={guestById.get(assignments[seat.id])}
              key={seat.id}
              onClear={onClearSeat}
              onDrop={onSeatDrop}
              onOpen={onOpenSeat}
              seat={seat}
              style={getRoundSeatStyle(index, seats.length)}
            />
          ))}
        </div>
      ) : (
        <div className="rectangle-layout">
          {topSeats.length > 0 && (
            <div className="seat-row top">
              {topSeats.map((seat) => (
                <SeatButton
                  assignment={assignments[seat.id]}
                  guest={guestById.get(assignments[seat.id])}
                  key={seat.id}
                  onClear={onClearSeat}
                  onDrop={onSeatDrop}
                  onOpen={onOpenSeat}
                  seat={seat}
                />
              ))}
            </div>
          )}
          <div className="middle-row">
            <div className="seat-column">
              {leftSeats.map((seat) => (
                <SeatButton
                  assignment={assignments[seat.id]}
                  guest={guestById.get(assignments[seat.id])}
                  key={seat.id}
                  onClear={onClearSeat}
                  onDrop={onSeatDrop}
                  onOpen={onOpenSeat}
                  seat={seat}
                />
              ))}
            </div>
            <div className="rect-table-label">Table</div>
            <div className="seat-column">
              {rightSeats.map((seat) => (
                <SeatButton
                  assignment={assignments[seat.id]}
                  guest={guestById.get(assignments[seat.id])}
                  key={seat.id}
                  onClear={onClearSeat}
                  onDrop={onSeatDrop}
                  onOpen={onOpenSeat}
                  seat={seat}
                />
              ))}
            </div>
          </div>
          {bottomSeats.length > 0 && (
            <div className="seat-row bottom">
              {bottomSeats.map((seat) => (
                <SeatButton
                  assignment={assignments[seat.id]}
                  guest={guestById.get(assignments[seat.id])}
                  key={seat.id}
                  onClear={onClearSeat}
                  onDrop={onSeatDrop}
                  onOpen={onOpenSeat}
                  seat={seat}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
