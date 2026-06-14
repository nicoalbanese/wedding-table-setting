import type { FormEvent } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <div className="modal-backdrop guest-edit-backdrop" onMouseDown={onClose}>
      <form
        className="modal guest-edit-modal"
        role="dialog"
        aria-modal="true"
        onSubmit={onSave}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Guest details</p>
            <h2>Edit guest</h2>
          </div>
          <Button className="icon-button" type="button" aria-label="Close" size="icon" variant="ghost" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="guest-edit-fields">
          <label className="field">
            <span>Name</span>
            <input autoFocus value={guestModal.name} onChange={(event) => onChange({ ...guestModal, name: event.target.value })} />
          </label>
          <label className="field">
            <span>Group</span>
            <input list="guest-groups" value={guestModal.group} onChange={(event) => onChange({ ...guestModal, group: event.target.value })} />
          </label>
          <label className="field">
            <span>Dietary restrictions</span>
            <textarea value={guestModal.dietary} onChange={(event) => onChange({ ...guestModal, dietary: event.target.value })} />
          </label>
        </div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!guestModal.name.trim()}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
