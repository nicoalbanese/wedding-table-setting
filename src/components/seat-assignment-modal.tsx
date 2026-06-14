import { Pencil } from "lucide-react";

import { DietaryBadges } from "@/components/dietary-badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Guest, Seat, SeatModalState, WeddingTable } from "@/planner/types";
import { findSeatForGuest } from "@/planner/utils";

type ActiveSeatModalState = NonNullable<SeatModalState>;

export function SeatAssignmentModal({
  assignedGuest,
  assignments,
  guests,
  onAssignGuest,
  onClearSeat,
  onClose,
  onEditGuest,
  onQueryChange,
  seat,
  seatById,
  seatedGuestIds,
  seatModal,
  table,
  tables,
}: {
  assignedGuest?: Guest;
  assignments: Record<string, string>;
  guests: Guest[];
  onAssignGuest: (guestId: string, seatId: string) => void;
  onClearSeat: (seatId: string) => void;
  onClose: () => void;
  onEditGuest: (guest: Guest) => void;
  onQueryChange: (query: string) => void;
  seat: Seat;
  seatById: Map<string, Seat>;
  seatedGuestIds: Set<string>;
  seatModal: ActiveSeatModalState;
  table?: WeddingTable;
  tables: WeddingTable[];
}) {
  const modalGuests = guests
    .filter((guest) => {
      const query = seatModal.query.trim().toLowerCase();
      if (!query) return true;
      return [guest.name, guest.group, guest.dietary].some((value) => value.toLowerCase().includes(query));
    })
    .sort((a, b) => Number(seatedGuestIds.has(a.id)) - Number(seatedGuestIds.has(b.id)) || a.name.localeCompare(b.name));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[min(760px,calc(100vh-40px))] max-w-[560px] overflow-hidden rounded-[10px] border-0 bg-white p-[18px] shadow-[0_24px_80px_rgba(32,32,29,0.32)]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="flex-row items-center justify-between gap-3 text-left">
          <div>
            <p className="m-0 text-xs font-bold tracking-normal text-[#6f6a60] uppercase">{table?.name}</p>
            <DialogTitle className="m-0 text-[15px] leading-tight">{seat.label}</DialogTitle>
          </div>
        </DialogHeader>
        {assignedGuest && (
          <div className="mt-3.5 flex items-center justify-between gap-3 rounded-lg border border-[#dbc7a0] bg-[#fff8e8] p-2.5 max-sm:flex-col max-sm:items-stretch">
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {assignedGuest.name}
              {assignedGuest.group ? (
                <small className="block overflow-hidden text-xs leading-tight text-ellipsis text-[#6f6a60]">
                  {assignedGuest.group}
                </small>
              ) : null}
            </span>
            <DietaryBadges dietary={assignedGuest.dietary} />
            <div className="flex flex-none gap-2 max-sm:w-full">
              <Button
                className="max-sm:flex-1"
                variant="secondary"
                type="button"
                aria-label={`Edit ${assignedGuest.name}`}
                onClick={() => onEditGuest(assignedGuest)}
              >
                <Pencil aria-hidden="true" />
                Edit
              </Button>
              <Button className="max-sm:flex-1" variant="secondary" type="button" onClick={() => onClearSeat(seat.id)}>
                Clear Seat
              </Button>
            </div>
          </div>
        )}
        <Input
          autoFocus
          className="my-3.5"
          placeholder="Search guests"
          value={seatModal.query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="grid max-h-[430px] gap-2 overflow-auto pr-1">
          {modalGuests.map((guest) => {
            const seatedAt = findSeatForGuest(assignments, guest.id);
            const seatedSeat = seatedAt ? seatById.get(seatedAt) : undefined;
            const seatedTable = seatedSeat ? tables.find((candidate) => candidate.id === seatedSeat.tableId) : undefined;
            return (
              <Button
                asChild
                className="grid min-h-[50px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-lg border border-[#d8d1c2] bg-[#f7f4ed] px-[11px] py-[9px] text-left text-[#211f1a] hover:border-[#2b7567] hover:bg-white max-sm:grid-cols-1"
                key={guest.id}
                variant="ghost"
              >
                <button type="button" onClick={() => onAssignGuest(guest.id, seat.id)}>
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {guest.name}
                    {guest.group ? <small className="block overflow-hidden text-xs leading-tight text-ellipsis text-[#6f6a60]">{guest.group}</small> : null}
                  </span>
                  <DietaryBadges dietary={guest.dietary} />
                  <em className="text-xs not-italic whitespace-nowrap text-[#2b7567] max-sm:whitespace-normal">
                    {seatedSeat ? `${seatedTable?.name}, ${seatedSeat.label}` : "Unseated"}
                  </em>
                </button>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
