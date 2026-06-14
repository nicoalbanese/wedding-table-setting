import type { CSSProperties, DragEvent } from "react";

import { DietaryBadges } from "@/components/dietary-badges";
import { cn } from "@/lib/utils";
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
      className={cn(
        "relative grid h-[58px] w-[86px] min-w-0 flex-[0_0_86px] cursor-pointer grid-rows-[minmax(0,1fr)_auto] items-center justify-items-center gap-[3px] overflow-hidden rounded-lg border border-dashed border-[#b7ac97] bg-white px-1.5 py-1 text-center text-xs leading-[1.12] font-[780] text-[#665e4f] transition-[background,border-color,box-shadow] hover:border-[#2b7567] hover:shadow-[0_0_0_3px_rgba(43,117,103,0.13)] max-sm:w-[74px] max-sm:flex-[0_0_74px]",
        guest && "border-solid border-[#c99832] bg-[#fff8e8] text-[#332b1c]",
        style && "absolute",
      )}
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
      <span className="line-clamp-2 max-w-full overflow-hidden text-center">{guest?.name ?? "+"}</span>
      {guest ? <DietaryBadges dietary={guest.dietary} compact /> : null}
      {guest && (
        <em
          className="absolute top-[3px] right-[3px] flex size-4 items-center justify-center rounded-full border border-[#dbc7a0] bg-white text-[10px] not-italic text-[#8b2f20]"
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
