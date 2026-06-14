import { Pencil, Trash2 } from "lucide-react";

import { DietaryBadges } from "@/components/dietary-badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <Card
      className="!grid min-h-14 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-lg border-[#d8d1c2] bg-white py-[9px] pr-[9px] pl-3 shadow-none transition-[border-color,box-shadow] hover:border-[#2b7567] hover:shadow-[0_8px_22px_rgba(43,117,103,0.1)]"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-guest-id", guest.id);
      }}
    >
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {guest.name}
        {guest.group ? <small className="block overflow-hidden text-xs leading-tight text-ellipsis text-[#6f6a60]">{guest.group}</small> : null}
      </span>
      <DietaryBadges dietary={guest.dietary} />
      <div className="flex justify-self-end gap-2">
        <Button
          className="text-[#2b7567] hover:border-[#2b7567] hover:bg-[#f2fbf8]"
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={`Edit ${guest.name}`}
          onClick={() => onEdit(guest)}
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          className="text-[#8b2f20] hover:border-[#e4b5aa] hover:bg-[#fff8f5]"
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={`Remove ${guest.name}`}
          onClick={() => onRemove(guest.id)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}
