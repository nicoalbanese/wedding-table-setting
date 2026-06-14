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
    <div className="min-h-screen min-w-80 bg-[#f0ede4] font-sans text-[#211f1a] antialiased">
      <main className="grid min-h-screen grid-cols-[minmax(320px,372px)_1fr] bg-[#f0ede4] max-[980px]:grid-cols-1 max-sm:min-h-auto">
        <aside className="flex max-h-screen flex-col overflow-auto border-r border-[#d8d1c2] bg-[#fffdfa] max-[980px]:max-h-none max-[980px]:border-r-0 max-[980px]:border-b">
          <section className="flex-none border-b border-[#d8d1c2] px-[18px] pt-[18px] pb-5 max-sm:px-3.5 max-sm:py-4">
            <div className="mb-3.5 flex items-baseline justify-between">
              <h2 className="m-0 text-[15px] leading-tight font-semibold">Tables</h2>
              <span className="text-xs font-semibold text-[#6f6a60]">{seats.length} seats</span>
            </div>
            <div className="grid gap-[9px]">
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
              <Button
                className="min-h-10 w-full border-dashed border-[#c7bda9] bg-transparent px-3 py-[9px] font-[820] text-[#2b7567] hover:border-[#2b7567] hover:bg-white"
                type="button"
                variant="outline"
                onClick={addTable}
              >
                <Plus aria-hidden="true" />
                Add Table
              </Button>
            </div>
          </section>

          <section className="flex-none border-b border-[#d8d1c2] px-[18px] pt-[18px] pb-5 max-sm:px-3.5 max-sm:py-4">
            <div className="mb-3.5 flex items-baseline justify-between">
              <h2 className="m-0 text-[15px] leading-tight font-semibold">Guests</h2>
              <span className="text-xs font-semibold text-[#6f6a60]">
                {state.guests.length - unseatedGuests.length}/{state.guests.length} seated
              </span>
            </div>
            <form className="grid gap-[9px]" onSubmit={addGuest}>
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
            <div className="mt-[13px] grid gap-[9px] border-t border-[#d8d1c2] pt-[13px]">
              <Label className="relative inline-flex min-h-9 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-[#d8d1c2] bg-white text-sm font-[760] transition-colors hover:border-[#2b7567] hover:text-[#2b7567]">
                <Input className="absolute inset-0 h-full opacity-0" accept=".csv,text/csv" type="file" onChange={handleCsvFile} />
                Choose CSV
              </Label>
              <Textarea
                className="min-h-[92px] resize-y"
                rows={4}
                placeholder="name,group,dietary&#10;Alice Smith,Family,Vegetarian"
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
              />
              <Button className="w-full" type="button" onClick={importGuestsFromCsv}>
                Import Guests
              </Button>
            </div>
          </section>

          <section className="flex max-h-[min(540px,calc(100vh-128px))] min-h-[220px] flex-none flex-col px-[18px] pt-[18px] pb-5 max-[980px]:max-h-none max-sm:px-3.5 max-sm:py-4">
            <div className="mb-3.5 flex items-baseline justify-between">
              <h2 className="m-0 text-[15px] leading-tight font-semibold">Unseated</h2>
              <span className="text-xs font-semibold text-[#6f6a60]">{unseatedGuests.length}</span>
            </div>
            <Button className="mb-3 w-full" type="button" onClick={autoSeatByGroup} disabled={unseatedGuests.length === 0}>
              Seat by Group
            </Button>
            <div className="grid max-h-[380px] flex-[0_1_auto] gap-[9px] overflow-auto pr-1">
              {unseatedGuests.length === 0 ? (
                <p className="m-0 text-sm text-[#6f6a60]">All guests have seats.</p>
              ) : (
                unseatedGuests.map((guest) => (
                  <GuestChip key={guest.id} guest={guest} onEdit={openGuestEditor} onRemove={removeGuest} />
                ))
              )}
            </div>
          </section>
        </aside>

        <section className="max-h-screen overflow-auto px-5 pt-[18px] pb-6 max-[980px]:max-h-none max-sm:p-3">
          <div className="mb-[18px] flex items-center justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch">
            <div
              className="grid max-w-[760px] flex-auto grid-cols-4 items-stretch overflow-hidden rounded-[9px] border border-[#d8d1c2] bg-[#fffdfa]/80 max-[720px]:max-w-none max-sm:grid-cols-2"
              aria-label="Plan status"
            >
              <Stat label="Tables" value={state.tables.length} />
              <Stat label="Seats" value={seats.length} />
              <Stat label="Guests" value={state.guests.length} />
              <Stat label="Open" value={Math.max(0, seats.length - Object.keys(state.assignments).length)} />
            </div>
            <div className="flex flex-none justify-end gap-[9px] max-[720px]:w-full">
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

          <div className="grid items-start gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(340px,1fr))] max-sm:grid-cols-1">
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
