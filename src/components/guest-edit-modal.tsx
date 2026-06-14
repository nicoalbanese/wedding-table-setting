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
      <DialogContent className="modal guest-edit-modal">
        <form onSubmit={onSave}>
          <DialogHeader className="modal-header">
            <div>
              <p className="eyebrow">Guest details</p>
              <DialogTitle>Edit guest</DialogTitle>
            </div>
          </DialogHeader>
          <div className="guest-edit-fields">
            <Label className="field">
              <span>Name</span>
              <Input autoFocus value={guestModal.name} onChange={(event) => onChange({ ...guestModal, name: event.target.value })} />
            </Label>
            <Label className="field">
              <span>Group</span>
              <Input list="guest-groups" value={guestModal.group} onChange={(event) => onChange({ ...guestModal, group: event.target.value })} />
            </Label>
            <Label className="field">
              <span>Dietary restrictions</span>
              <Textarea value={guestModal.dietary} onChange={(event) => onChange({ ...guestModal, dietary: event.target.value })} />
            </Label>
          </div>
          <DialogFooter className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!guestModal.name.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
