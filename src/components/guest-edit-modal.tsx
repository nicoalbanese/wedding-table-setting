import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Messages } from "@/i18n";
import type { GuestEditModalState } from "@/planner/types";

type ActiveGuestEditModalState = NonNullable<GuestEditModalState>;

export function GuestEditModal({
  guestModal,
  onChange,
  onClose,
  onSave,
  t,
}: {
  guestModal: ActiveGuestEditModalState;
  onChange: (guestModal: ActiveGuestEditModalState) => void;
  onClose: () => void;
  onSave: (event: FormEvent) => void;
  t: Messages;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-dvh max-w-lg overflow-hidden rounded-lg border-0 bg-background p-5 shadow-2xl">
        <form onSubmit={onSave}>
          <DialogHeader className="flex-row items-center justify-between gap-3 text-left">
            <div>
              <p className="m-0 text-xs font-bold tracking-normal text-muted-foreground uppercase">{t.modals.guestDetails}</p>
              <DialogTitle className="m-0 text-sm leading-tight">{t.modals.editGuest}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="mt-4 grid gap-3">
            <Label className="grid gap-1.5">
              <span className="text-xs font-bold text-foreground/80">{t.fields.name}</span>
              <Input autoFocus value={guestModal.name} onChange={(event) => onChange({ ...guestModal, name: event.target.value })} />
            </Label>
            <Label className="grid gap-1.5">
              <span className="text-xs font-bold text-foreground/80">{t.fields.group}</span>
              <Input list="guest-groups" value={guestModal.group} onChange={(event) => onChange({ ...guestModal, group: event.target.value })} />
            </Label>
            <Label className="grid gap-1.5">
              <span className="text-xs font-bold text-foreground/80">{t.fields.dietaryRestrictions}</span>
              <Textarea
                className="min-h-24 resize-y"
                value={guestModal.dietary}
                onChange={(event) => onChange({ ...guestModal, dietary: event.target.value })}
              />
            </Label>
          </div>
          <DialogFooter className="mt-5 flex justify-end gap-2.5 max-sm:w-full max-sm:flex-row">
            <Button className="max-sm:flex-1" type="button" variant="secondary" onClick={onClose}>
              {t.actions.cancel}
            </Button>
            <Button className="max-sm:flex-1" type="submit" disabled={!guestModal.name.trim()}>
              {t.actions.saveChanges}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
