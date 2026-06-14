import { Pencil, X } from "lucide-react";

import { DietaryBadges } from "@/components/dietary-badges";
import { Button } from "@/components/ui/button";
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
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{table?.name}</p>
            <h2>{seat.label}</h2>
          </div>
          <Button className="icon-button" type="button" aria-label="Close" size="icon" variant="ghost" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </div>
        {assignedGuest && (
          <div className="current-seat">
            <span>
              {assignedGuest.name}
              {assignedGuest.group ? <small>{assignedGuest.group}</small> : null}
            </span>
            <DietaryBadges dietary={assignedGuest.dietary} />
            <div className="current-seat-actions">
              <Button variant="secondary" type="button" aria-label={`Edit ${assignedGuest.name}`} onClick={() => onEditGuest(assignedGuest)}>
                <Pencil aria-hidden="true" />
                Edit
              </Button>
              <Button variant="secondary" type="button" onClick={() => onClearSeat(seat.id)}>
                Clear Seat
              </Button>
            </div>
          </div>
        )}
        <input
          autoFocus
          className="search-input"
          placeholder="Search guests"
          value={seatModal.query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="modal-guest-list">
          {modalGuests.map((guest) => {
            const seatedAt = findSeatForGuest(assignments, guest.id);
            const seatedSeat = seatedAt ? seatById.get(seatedAt) : undefined;
            const seatedTable = seatedSeat ? tables.find((candidate) => candidate.id === seatedSeat.tableId) : undefined;
            return (
              <button className="guest-option" key={guest.id} type="button" onClick={() => onAssignGuest(guest.id, seat.id)}>
                <span>
                  {guest.name}
                  {guest.group ? <small>{guest.group}</small> : null}
                </span>
                <DietaryBadges dietary={guest.dietary} />
                <em>{seatedSeat ? `${seatedTable?.name}, ${seatedSeat.label}` : "Unseated"}</em>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
