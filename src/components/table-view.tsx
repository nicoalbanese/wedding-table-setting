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
    <article className="min-h-0 rounded-[10px] border border-[#d8d1c2] bg-[#fffdfa]/90 p-3.5 shadow-[0_18px_44px_rgba(45,39,28,0.08)] transition-[border-color,box-shadow] hover:border-[#c7bda9] hover:shadow-[0_20px_54px_rgba(45,39,28,0.1)]">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <Input
          aria-label={`Name for ${table.name}`}
          className="h-[34px] w-auto flex-auto border-transparent bg-transparent px-[7px] py-[5px] text-[15px] font-[820] hover:border-[#d8d1c2] hover:bg-white"
          value={table.name}
          onChange={(event) => onRename(event.target.value)}
        />
        <div className="flex flex-none items-center gap-2">
          <span className="text-xs font-semibold text-[#6f6a60]">
            {assignedCount}/{seats.length}
          </span>
          <Button
            className="min-h-[30px] px-2 py-[5px] text-xs font-[780] disabled:border-[#d8d1c2] disabled:bg-[#f7f4ed] disabled:text-[#9b968c]"
            type="button"
            variant="destructive"
            onClick={onClearTable}
            disabled={assignedCount === 0}
          >
            Unseat Table
          </Button>
        </div>
      </div>
      {table.shape === "round" ? (
        <div className="relative mx-auto aspect-square min-h-[300px] max-w-[430px] max-sm:min-h-[280px]">
          <div className="absolute top-1/2 left-1/2 flex h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#adc9b9] bg-[#dce8de] font-[860] text-[#1f5d52]">
            Round
          </div>
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
        <div className="grid min-h-0 gap-2.5">
          {topSeats.length > 0 && (
            <div className="flex min-h-[58px] justify-center gap-2">
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
          <div className="grid min-h-0 grid-cols-[minmax(82px,90px)_minmax(120px,1fr)_minmax(82px,90px)] items-stretch gap-3 max-sm:grid-cols-[minmax(72px,76px)_minmax(96px,1fr)_minmax(72px,76px)] max-sm:gap-2">
            <div className="grid content-center gap-2">
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
            <div className="flex min-h-[170px] items-center justify-center rounded-[9px] border border-[#baaf99] bg-[#e4ddcd] font-[860] text-[#504833]">
              Table
            </div>
            <div className="grid content-center gap-2">
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
            <div className="flex min-h-[58px] justify-center gap-2">
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
