import { Pencil, Plus } from "lucide-react";

import { DietaryBadges } from "@/components/dietary-badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Messages } from "@/i18n";
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
  onCreateGuest,
  onEditGuest,
  onQueryChange,
  seat,
  seatById,
  seatedGuestIds,
  seatModal,
  table,
  tables,
  t,
}: {
  assignedGuest?: Guest;
  assignments: Record<string, string>;
  guests: Guest[];
  onAssignGuest: (guestId: string, seatId: string) => void;
  onClearSeat: (seatId: string) => void;
  onClose: () => void;
  onCreateGuest: (name: string, seatId: string) => void;
  onEditGuest: (guest: Guest) => void;
  onQueryChange: (query: string) => void;
  seat: Seat;
  seatById: Map<string, Seat>;
  seatedGuestIds: Set<string>;
  seatModal: ActiveSeatModalState;
  table?: WeddingTable;
  tables: WeddingTable[];
  t: Messages;
}) {
  const query = seatModal.query.trim();
  const modalGuests = guests
    .filter((guest) => {
      const normalizedQuery = query.toLowerCase();
      if (!normalizedQuery) return true;
      return [guest.name, guest.group, guest.dietary].some((value) => value.toLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => Number(seatedGuestIds.has(a.id)) - Number(seatedGuestIds.has(b.id)) || a.name.localeCompare(b.name));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-dvh max-w-xl overflow-hidden rounded-lg border-0 bg-background p-5 shadow-2xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="flex-row items-center justify-between gap-3 text-left">
          <div>
            <p className="m-0 text-xs font-bold tracking-normal text-muted-foreground uppercase">{table?.name}</p>
            <DialogTitle className="m-0 text-sm leading-tight">{seat.label}</DialogTitle>
            <DialogDescription className="sr-only">Choose a guest to assign to this seat, edit the assigned guest, or clear the seat.</DialogDescription>
          </div>
        </DialogHeader>
        {assignedGuest && (
          <div className="mt-3.5 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-seat-filled p-2.5 max-sm:flex-col max-sm:items-stretch">
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {assignedGuest.name}
              {assignedGuest.group ? (
                <small className="block overflow-hidden text-xs leading-tight text-ellipsis text-muted-foreground">
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
                aria-label={t.aria.editGuest(assignedGuest.name)}
                onClick={() => onEditGuest(assignedGuest)}
              >
                <Pencil aria-hidden="true" />
                {t.actions.edit}
              </Button>
              <Button className="max-sm:flex-1" variant="secondary" type="button" onClick={() => onClearSeat(seat.id)}>
                {t.actions.clearSeat}
              </Button>
            </div>
          </div>
        )}
        <Input
          autoFocus
          className="my-3.5"
          placeholder={t.fields.searchGuests}
          value={seatModal.query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="grid max-h-96 gap-2 overflow-auto pr-1">
          {modalGuests.map((guest) => {
            const seatedAt = findSeatForGuest(assignments, guest.id);
            const seatedSeat = seatedAt ? seatById.get(seatedAt) : undefined;
            const seatedTable = seatedSeat ? tables.find((candidate) => candidate.id === seatedSeat.tableId) : undefined;
            return (
              <Button
                asChild
                className="grid min-h-12 grid-cols-12 items-center gap-2.5 rounded-lg border border-border bg-accent px-3 py-2.5 text-left text-foreground hover:border-primary hover:bg-background max-sm:grid-cols-1"
                key={guest.id}
                variant="ghost"
              >
                <button type="button" onClick={() => onAssignGuest(guest.id, seat.id)}>
                  <span className="col-span-5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {guest.name}
                    {guest.group ? <small className="block overflow-hidden text-xs leading-tight text-ellipsis text-muted-foreground">{guest.group}</small> : null}
                  </span>
                  <div className="col-span-4 justify-self-end">
                    <DietaryBadges dietary={guest.dietary} />
                  </div>
                  <em className="col-span-3 text-xs not-italic whitespace-nowrap text-primary max-sm:whitespace-normal">
                    {seatedSeat ? `${seatedTable?.name}, ${seatedSeat.label}` : t.statuses.unseated}
                  </em>
                </button>
              </Button>
            );
          })}
          {modalGuests.length === 0 && query ? (
            <div className="grid gap-2 rounded-lg border border-dashed border-border bg-accent p-3">
              <p className="m-0 text-sm text-muted-foreground">{t.empty.noGuestsFound}</p>
              <Button className="w-full justify-start" type="button" onClick={() => onCreateGuest(query, seat.id)}>
                <Plus aria-hidden="true" />
                {t.templates.createGuest(query)}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
