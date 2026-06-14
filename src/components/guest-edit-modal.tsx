import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GuestEditModalState } from "@/planner/types";

type ActiveGuestEditModalState = NonNullable<GuestEditModalState>;

export function GuestEditModal({
  guestModal,
  onChange,
  onClose,
  onSave,
}: {
  guestModal: ActiveGuestEditModalState;
  onChange: (guestModal: ActiveGuestEditModalState) => void;
  onClose: () => void;
  onSave: (event: FormEvent) => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(760px,calc(100vh-40px))] max-w-[480px] overflow-hidden rounded-[10px] border-0 bg-white p-[18px] shadow-[0_24px_80px_rgba(32,32,29,0.32)]">
        <form onSubmit={onSave}>
          <DialogHeader className="flex-row items-center justify-between gap-3 text-left">
            <div>
              <p className="m-0 text-xs font-bold tracking-normal text-[#6f6a60] uppercase">Guest details</p>
              <DialogTitle className="m-0 text-[15px] leading-tight">Edit guest</DialogTitle>
            </div>
          </DialogHeader>
          <div className="mt-4 grid gap-3">
            <Label className="grid gap-1.5">
              <span className="text-xs font-bold text-[#504b42]">Name</span>
              <Input autoFocus value={guestModal.name} onChange={(event) => onChange({ ...guestModal, name: event.target.value })} />
            </Label>
            <Label className="grid gap-1.5">
              <span className="text-xs font-bold text-[#504b42]">Group</span>
              <Input list="guest-groups" value={guestModal.group} onChange={(event) => onChange({ ...guestModal, group: event.target.value })} />
            </Label>
            <Label className="grid gap-1.5">
              <span className="text-xs font-bold text-[#504b42]">Dietary restrictions</span>
              <Textarea
                className="min-h-[92px] resize-y"
                value={guestModal.dietary}
                onChange={(event) => onChange({ ...guestModal, dietary: event.target.value })}
              />
            </Label>
          </div>
          <DialogFooter className="mt-[18px] flex justify-end gap-2.5 max-sm:w-full max-sm:flex-row">
            <Button className="max-sm:flex-1" type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button className="max-sm:flex-1" type="submit" disabled={!guestModal.name.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
