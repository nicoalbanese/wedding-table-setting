import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Plus, RotateCcw } from "lucide-react";

import { GuestChip } from "@/components/guest-chip";
import { GuestEditModal } from "@/components/guest-edit-modal";
import { SeatAssignmentModal } from "@/components/seat-assignment-modal";
import { Stat } from "@/components/stat";
import { TableEditor } from "@/components/table-editor";
import { TableView } from "@/components/table-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATE_QUERY_KEY, starterState } from "@/planner/constants";
import type { Guest, GuestEditModalState, NewGuestForm, PlannerState, SeatModalState, WeddingTable } from "@/planner/types";
import {
  createDefaultTable,
  createId,
  createSeatsForTable,
  encodeState,
  escapeCsvCell,
  findSeatForGuest,
  groupGuests,
  loadStateFromUrl,
  parseGuestsCsv,
  sanitizeAssignments,
} from "@/planner/utils";

export function App() {
  const [state, setState] = useState<PlannerState>(() => loadStateFromUrl() ?? starterState);
  const [seatModal, setSeatModal] = useState<SeatModalState>(null);
  const [guestModal, setGuestModal] = useState<GuestEditModalState>(null);
  const [csvText, setCsvText] = useState("");
  const [newGuest, setNewGuest] = useState<NewGuestForm>({ name: "", group: "", dietary: "" });
  const [openTableEditorIds, setOpenTableEditorIds] = useState<Set<string>>(() =>
    new Set(state.tables[0] ? [state.tables[0].id] : []),
  );

  const seats = useMemo(() => state.tables.flatMap(createSeatsForTable), [state.tables]);
  const seatById = useMemo(() => new Map(seats.map((seat) => [seat.id, seat])), [seats]);
  const guestById = useMemo(() => new Map(state.guests.map((guest) => [guest.id, guest])), [state.guests]);
  const seatedGuestIds = useMemo(() => new Set(Object.values(state.assignments)), [state.assignments]);
  const unseatedGuests = useMemo(
    () => state.guests.filter((guest) => !seatedGuestIds.has(guest.id)),
    [state.guests, seatedGuestIds],
  );
  const groups = useMemo(() => {
    const uniqueGroups = new Set(state.guests.map((guest) => guest.group).filter(Boolean));
    return [...uniqueGroups].sort((a, b) => a.localeCompare(b));
  }, [state.guests]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const encoded = encodeState(state);
    if (url.searchParams.get(STATE_QUERY_KEY) !== encoded) {
      url.searchParams.set(STATE_QUERY_KEY, encoded);
      window.history.replaceState(null, "", url);
    }
  }, [state]);

  useEffect(() => {
    setState((current) => sanitizeAssignments(current));
  }, [seats]);

  function updateTable(tableId: string, patch: Partial<WeddingTable>) {
    setState((current) =>
      sanitizeAssignments({
        ...current,
        tables: current.tables.map((table) => (table.id === tableId ? { ...table, ...patch } : table)),
      }),
    );
  }

  function addTable() {
    const table = createDefaultTable(state.tables.length + 1);
    setState((current) => ({ ...current, tables: [...current.tables, table] }));
    setOpenTableEditorIds((current) => new Set([...current, table.id]));
  }

  function removeTable(tableId: string) {
    setState((current) => {
      if (current.tables.length <= 1) return current;
      const table = current.tables.find((item) => item.id === tableId);
      if (!table) return current;

      const removedSeatIds = new Set(createSeatsForTable(table).map((seat) => seat.id));
      const assignments = { ...current.assignments };
      for (const seatId of removedSeatIds) {
        delete assignments[seatId];
      }

      return {
        ...current,
        assignments,
        tables: current.tables.filter((item) => item.id !== tableId),
      };
    });
    setOpenTableEditorIds((current) => {
      const next = new Set(current);
      next.delete(tableId);
      return next;
    });
  }

  function addGuest(event: FormEvent) {
    event.preventDefault();
    const name = newGuest.name.trim();
    if (!name) return;
    const guest: Guest = {
      id: createId("guest"),
      name,
      group: newGuest.group.trim(),
      dietary: newGuest.dietary.trim(),
    };
    setState((current) => ({ ...current, guests: [...current.guests, guest] }));
    setNewGuest({ name: "", group: newGuest.group, dietary: "" });
  }

  function importGuestsFromCsv() {
    const imported = parseGuestsCsv(csvText);
    if (imported.length === 0) return;
    setState((current) => {
      const existingKeys = new Set(current.guests.map((guest) => guest.name.trim().toLowerCase()));
      const guests = imported
        .filter((guest) => {
          const key = guest.name.trim().toLowerCase();
          if (!key || existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        })
        .map((guest) => ({ ...guest, id: createId("guest") }));
      return { ...current, guests: [...current.guests, ...guests] };
    });
    setCsvText("");
  }

  function handleCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then(setCsvText);
    event.target.value = "";
  }

  function assignGuestToSeat(guestId: string, seatId: string) {
    setState((current) => {
      const nextAssignments = { ...current.assignments };
      const sourceSeatId = findSeatForGuest(current.assignments, guestId);
      const targetGuestId = nextAssignments[seatId];

      if (sourceSeatId === seatId) return current;
      if (sourceSeatId) delete nextAssignments[sourceSeatId];
      if (targetGuestId) delete nextAssignments[seatId];
      if (sourceSeatId && targetGuestId) nextAssignments[sourceSeatId] = targetGuestId;
      nextAssignments[seatId] = guestId;

      return { ...current, assignments: nextAssignments };
    });
    setSeatModal(null);
  }

  function clearSeat(seatId: string) {
    setState((current) => {
      const nextAssignments = { ...current.assignments };
      delete nextAssignments[seatId];
      return { ...current, assignments: nextAssignments };
    });
  }

  function clearTable(tableId: string) {
    setState((current) => {
      const table = current.tables.find((item) => item.id === tableId);
      const tableSeatIds = new Set(table ? createSeatsForTable(table).map((seat) => seat.id) : []);
      if (tableSeatIds.size === 0) return current;

      const nextAssignments = { ...current.assignments };
      for (const seatId of tableSeatIds) {
        delete nextAssignments[seatId];
      }
      return { ...current, assignments: nextAssignments };
    });
  }

  function removeGuest(guestId: string) {
    setState((current) => {
      const assignments = { ...current.assignments };
      for (const [seatId, assignedGuestId] of Object.entries(assignments)) {
        if (assignedGuestId === guestId) delete assignments[seatId];
      }
      return {
        ...current,
        guests: current.guests.filter((guest) => guest.id !== guestId),
        assignments,
      };
    });
    setGuestModal((current) => (current?.guestId === guestId ? null : current));
  }

  function openGuestEditor(guest: Guest) {
    setGuestModal({
      guestId: guest.id,
      name: guest.name,
      group: guest.group,
      dietary: guest.dietary,
    });
  }

  function saveGuest(event: FormEvent) {
    event.preventDefault();
    if (!guestModal) return;

    const name = guestModal.name.trim();
    if (!name) return;

    setState((current) => ({
      ...current,
      guests: current.guests.map((guest) =>
        guest.id === guestModal.guestId
          ? {
              ...guest,
              name,
              group: guestModal.group.trim(),
              dietary: guestModal.dietary.trim(),
            }
          : guest,
      ),
    }));
    setGuestModal(null);
  }

  function autoSeatByGroup() {
    setState((current) => {
      const allSeats = current.tables.flatMap(createSeatsForTable);
      const assignments = { ...current.assignments };
      const occupied = new Set(Object.keys(assignments));
      const assignedGuests = new Set(Object.values(assignments));
      const unseated = current.guests.filter((guest) => !assignedGuests.has(guest.id));
      const grouped = groupGuests(unseated);
      const emptySeatsByTable = current.tables.map((table) => ({
        tableId: table.id,
        seats: allSeats.filter((seat) => seat.tableId === table.id && !occupied.has(seat.id)),
      }));

      for (const guests of grouped) {
        let remainingGuests = [...guests];
        while (remainingGuests.length > 0) {
          const exactTable = emptySeatsByTable.find((table) => table.seats.length >= remainingGuests.length);
          const table =
            exactTable ??
            [...emptySeatsByTable].sort((a, b) => b.seats.length - a.seats.length).find((item) => item.seats.length > 0);
          if (!table) break;

          while (remainingGuests.length > 0 && table.seats.length > 0) {
            const guest = remainingGuests.shift()!;
            const seat = table.seats.shift()!;
            assignments[seat.id] = guest.id;
            occupied.add(seat.id);
          }
        }
      }

      return { ...current, assignments };
    });
  }

  function resetPlanner() {
    if (!window.confirm("Reset the planner and clear guests, tables, and assignments?")) return;
    setState(starterState);
    setSeatModal(null);
    setGuestModal(null);
    setOpenTableEditorIds(new Set(starterState.tables[0] ? [starterState.tables[0].id] : []));
  }

  function exportCsv() {
    const rows = [["guest", "group", "dietary", "table", "seat"]];
    for (const guest of state.guests) {
      const seatId = findSeatForGuest(state.assignments, guest.id);
      const seat = seatId ? seatById.get(seatId) : undefined;
      const table = seat ? state.tables.find((item) => item.id === seat.tableId) : undefined;
      rows.push([guest.name, guest.group, guest.dietary, table?.name ?? "", seat?.label ?? ""]);
    }
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wedding-seating.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function onSeatDrop(event: DragEvent<HTMLButtonElement>, seatId: string) {
    event.preventDefault();
    const guestId = event.dataTransfer.getData("application/x-guest-id");
    if (guestId) assignGuestToSeat(guestId, seatId);
  }

  const modalSeat = seatModal ? seatById.get(seatModal.seatId) : undefined;
  const modalTable = modalSeat ? state.tables.find((table) => table.id === modalSeat.tableId) : undefined;
  const modalAssignedGuest = modalSeat ? guestById.get(state.assignments[modalSeat.id]) : undefined;

  return (
    <div className="app-shell">
      <main className="workspace">
        <aside className="sidebar">
          <section className="panel">
            <div className="section-heading">
              <h2>Tables</h2>
              <span>{seats.length} seats</span>
            </div>
            <div className="table-editor-list">
              {state.tables.map((table) => (
                <TableEditor
                  key={table.id}
                  isOpen={openTableEditorIds.has(table.id)}
                  onChange={(patch) => updateTable(table.id, patch)}
                  onRemove={() => removeTable(table.id)}
                  onToggle={(isOpen) =>
                    setOpenTableEditorIds((current) => {
                      const next = new Set(current);
                      if (isOpen) {
                        next.add(table.id);
                      } else {
                        next.delete(table.id);
                      }
                      return next;
                    })
                  }
                  canRemove={state.tables.length > 1}
                  table={table}
                />
              ))}
              <Button className="add-table-button" type="button" variant="outline" onClick={addTable}>
                <Plus aria-hidden="true" />
                Add Table
              </Button>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>Guests</h2>
              <span>
                {state.guests.length - unseatedGuests.length}/{state.guests.length} seated
              </span>
            </div>
            <form className="guest-form" onSubmit={addGuest}>
              <Input
                placeholder="Name"
                value={newGuest.name}
                onChange={(event) => setNewGuest({ ...newGuest, name: event.target.value })}
              />
              <Input
                placeholder="Group"
                list="guest-groups"
                value={newGuest.group}
                onChange={(event) => setNewGuest({ ...newGuest, group: event.target.value })}
              />
              <Input
                placeholder="Dietary"
                value={newGuest.dietary}
                onChange={(event) => setNewGuest({ ...newGuest, dietary: event.target.value })}
              />
              <Button type="submit">Add Guest</Button>
            </form>
            <datalist id="guest-groups">
              {groups.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
            <div className="csv-import">
              <Label className="file-input">
                <Input accept=".csv,text/csv" type="file" onChange={handleCsvFile} />
                Choose CSV
              </Label>
              <Textarea
                rows={4}
                placeholder="name,group,dietary&#10;Alice Smith,Family,Vegetarian"
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
              />
              <Button type="button" variant="secondary" onClick={importGuestsFromCsv}>
                Import Guests
              </Button>
            </div>
          </section>

          <section className="panel guest-pool">
            <div className="section-heading">
              <h2>Unseated</h2>
              <span>{unseatedGuests.length}</span>
            </div>
            <Button className="mb-3 w-full" type="button" onClick={autoSeatByGroup} disabled={unseatedGuests.length === 0}>
              Seat by Group
            </Button>
            <div className="guest-list">
              {unseatedGuests.length === 0 ? (
                <p className="empty-copy">All guests have seats.</p>
              ) : (
                unseatedGuests.map((guest) => (
                  <GuestChip key={guest.id} guest={guest} onEdit={openGuestEditor} onRemove={removeGuest} />
                ))
              )}
            </div>
          </section>
        </aside>

        <section className="canvas">
          <div className="canvas-toolbar">
            <div className="status-strip" aria-label="Plan status">
              <Stat label="Tables" value={state.tables.length} />
              <Stat label="Seats" value={seats.length} />
              <Stat label="Guests" value={state.guests.length} />
              <Stat label="Open" value={Math.max(0, seats.length - Object.keys(state.assignments).length)} />
            </div>
            <div className="canvas-actions">
              <Button className="flex-1 sm:flex-none" type="button" variant="secondary" onClick={exportCsv}>
                <Download aria-hidden="true" />
                Export CSV
              </Button>
              <Button className="flex-1 sm:flex-none" type="button" variant="destructive" onClick={resetPlanner}>
                <RotateCcw aria-hidden="true" />
                Reset
              </Button>
            </div>
          </div>

          <div className="tables-grid">
            {state.tables.map((table) => (
              <TableView
                key={table.id}
                assignments={state.assignments}
                guestById={guestById}
                onClearSeat={clearSeat}
                onClearTable={() => clearTable(table.id)}
                onRename={(name) => updateTable(table.id, { name })}
                onOpenSeat={(seatId) => setSeatModal({ seatId, query: "" })}
                onSeatDrop={onSeatDrop}
                table={table}
              />
            ))}
          </div>
        </section>
      </main>

      {seatModal && modalSeat && (
        <SeatAssignmentModal
          assignedGuest={modalAssignedGuest}
          assignments={state.assignments}
          guests={state.guests}
          onAssignGuest={assignGuestToSeat}
          onClearSeat={clearSeat}
          onClose={() => setSeatModal(null)}
          onEditGuest={openGuestEditor}
          onQueryChange={(query) => setSeatModal((current) => (current ? { ...current, query } : current))}
          seat={modalSeat}
          seatById={seatById}
          seatedGuestIds={seatedGuestIds}
          seatModal={seatModal}
          table={modalTable}
          tables={state.tables}
        />
      )}

      {guestModal && (
        <GuestEditModal
          guestModal={guestModal}
          onChange={(nextGuestModal) => setGuestModal(nextGuestModal)}
          onClose={() => setGuestModal(null)}
          onSave={saveGuest}
        />
      )}
    </div>
  );
}
