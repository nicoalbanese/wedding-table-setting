import { Pencil, Trash2 } from "lucide-react";

import { DietaryBadges } from "@/components/dietary-badges";
import { Button } from "@/components/ui/button";
import type { Guest } from "@/planner/types";

export function GuestChip({
  guest,
  onEdit,
  onRemove,
}: {
  guest: Guest;
  onEdit: (guest: Guest) => void;
  onRemove: (guestId: string) => void;
}) {
  return (
    <div
      className="guest-chip"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-guest-id", guest.id);
      }}
    >
      <span>
        {guest.name}
        {guest.group ? <small>{guest.group}</small> : null}
      </span>
      <DietaryBadges dietary={guest.dietary} />
      <Button className="guest-edit-button" type="button" size="sm" variant="ghost" aria-label={`Edit ${guest.name}`} onClick={() => onEdit(guest)}>
        <Pencil aria-hidden="true" />
        Edit
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${guest.name}`} onClick={() => onRemove(guest.id)}>
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}
