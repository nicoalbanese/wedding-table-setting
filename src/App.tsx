import { type CSSProperties, ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Languages, Plus, Share2 } from "lucide-react";

import { GuestChip } from "@/components/guest-chip";
import { GuestEditModal } from "@/components/guest-edit-modal";
import { SeatAssignmentModal } from "@/components/seat-assignment-modal";
import { Stat } from "@/components/stat";
import { TableEditor } from "@/components/table-editor";
import { TableView } from "@/components/table-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { type Messages, useI18n } from "@/i18n";
import { createStarterState, LEGACY_STATE_QUERY_KEY, STATE_QUERY_KEY } from "@/planner/constants";
import type { Guest, GuestEditModalState, NewGuestForm, PlannerState, SeatModalState, WeddingTable } from "@/planner/types";
import {
  createDefaultTable,
  createId,
  createSeatsForTable,
  encodeState,
  findSeatForGuest,
  groupGuests,
  loadStateFromUrl,
  parseGuestsCsv,
  sanitizeAssignments,
} from "@/planner/utils";

export function App() {
  const { locale, setLocale, t } = useI18n();
  const [state, setState] = useState<PlannerState>(() => loadStateFromUrl() ?? createStarterState(t.defaults));
  const [seatModal, setSeatModal] = useState<SeatModalState>(null);
  const [guestModal, setGuestModal] = useState<GuestEditModalState>(null);
  const [csvText, setCsvText] = useState("");
  const [newGuest, setNewGuest] = useState<NewGuestForm>({ name: "", group: "", dietary: "" });
  const [openTableEditorIds, setOpenTableEditorIds] = useState<Set<string>>(() => new Set());
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  const seats = useMemo(() => state.tables.flatMap((table) => createSeatsForTable(table, t.seats)), [state.tables, t.seats]);
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
      url.searchParams.delete(LEGACY_STATE_QUERY_KEY);
      window.history.replaceState(null, "", url);
    }
  }, [state]);

  useEffect(() => {
    setState((current) => sanitizeAssignments(current));
  }, [seats]);

  useEffect(() => {
    if (!shareOpen) return;

    setShareUrl(createShareUrl(state));
    setShareCopied(false);
  }, [shareOpen, state]);

  function updateTable(tableId: string, patch: Partial<WeddingTable>) {
    setState((current) =>
      sanitizeAssignments({
        ...current,
        tables: current.tables.map((table) => (table.id === tableId ? { ...table, ...patch } : table)),
      }),
    );
  }

  function addTable() {
    const table = createDefaultTable(state.tables.length + 1, t.defaults.table);
    setState((current) => ({ ...current, tables: [...current.tables, table] }));
    setOpenTableEditorIds((current) => new Set([...current, table.id]));
  }

  function duplicateTable(tableId: string) {
    const source = state.tables.find((table) => table.id === tableId);
    if (!source) return;

    const table: WeddingTable = {
      ...source,
      id: createId("table"),
      name: createDuplicateTableName(source.name, state.tables, t.defaults.copySuffix),
    };

    setState((current) => {
      const sourceIndex = current.tables.findIndex((item) => item.id === tableId);
      if (sourceIndex === -1) return current;

      const tables = [...current.tables];
      tables.splice(sourceIndex + 1, 0, table);
      return { ...current, tables };
    });
    setOpenTableEditorIds((current) => new Set([...current, table.id]));
  }

  function removeTable(tableId: string) {
    setState((current) => {
      if (current.tables.length <= 1) return current;
      const table = current.tables.find((item) => item.id === tableId);
      if (!table) return current;

      const removedSeatIds = new Set(createSeatsForTable(table, t.seats).map((seat) => seat.id));
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

  function createGuestForSeat(name: string, seatId: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const guest: Guest = {
      id: createId("guest"),
      name: trimmedName,
      group: "",
      dietary: "",
    };

    setState((current) => ({
      ...current,
      guests: [...current.guests, guest],
      assignments: {
        ...current.assignments,
        [seatId]: guest.id,
      },
    }));
    setSeatModal(null);
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
      const tableSeatIds = new Set(table ? createSeatsForTable(table, t.seats).map((seat) => seat.id) : []);
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
      const allSeats = current.tables.flatMap((table) => createSeatsForTable(table, t.seats));
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

  function onSeatDrop(event: DragEvent<HTMLButtonElement>, seatId: string) {
    event.preventDefault();
    const guestId = event.dataTransfer.getData("application/x-guest-id");
    if (guestId) assignGuestToSeat(guestId, seatId);
  }

  async function copyShareLink(input: HTMLInputElement | null) {
    const url = createShareUrl(state);
    setShareUrl(url);
    let didCopy = false;

    try {
      await navigator.clipboard.writeText(url);
      didCopy = true;
    } catch {
      input?.focus();
      input?.select();
      didCopy = document.execCommand("copy");
    }

    setShareCopied(didCopy);
  }

  const modalSeat = seatModal ? seatById.get(seatModal.seatId) : undefined;
  const modalTable = modalSeat ? state.tables.find((table) => table.id === modalSeat.tableId) : undefined;
  const modalAssignedGuest = modalSeat ? guestById.get(state.assignments[modalSeat.id]) : undefined;

  return (
    <div className="min-h-screen min-w-80 bg-canvas font-sans text-foreground antialiased">
      <SidebarProvider className="bg-canvas" style={{ "--sidebar-width": "24rem" } as CSSProperties}>
        <Sidebar className="border-border" collapsible="offcanvas">
          <SidebarHeader className="border-b border-border bg-background p-2">
            <div className="flex min-h-10 items-center justify-between gap-2 px-2">
              <div className="min-w-0">
                <h2 className="m-0 text-sm leading-tight font-semibold">{t.sections.tables}</h2>
                <span className="text-xs font-semibold text-muted-foreground">{t.counts.seats(seats.length)}</span>
              </div>
              <SidebarTrigger className="flex-none" />
            </div>
          </SidebarHeader>
          <SidebarContent className="gap-0 bg-background">
            <SidebarGroup className="border-b border-border p-4 sm:p-5">
              <div className="grid gap-2.5">
                {state.tables.map((table) => (
                  <TableEditor
                    key={table.id}
                    isOpen={openTableEditorIds.has(table.id)}
                    onChange={(patch) => updateTable(table.id, patch)}
                    onDuplicate={() => duplicateTable(table.id)}
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
                    t={t}
                  />
                ))}
                <Button
                  className="min-h-10 w-full border-dashed border-input bg-transparent px-3 py-2 font-extrabold text-primary hover:border-primary hover:bg-background"
                  type="button"
                  variant="outline"
                  onClick={addTable}
                >
                  <Plus aria-hidden="true" />
                  {t.actions.addTable}
                </Button>
              </div>
            </SidebarGroup>

            <SidebarGroup className="border-b border-border p-4 sm:p-5">
              <div className="mb-3.5 flex items-baseline justify-between">
                <h2 className="m-0 text-sm leading-tight font-semibold">{t.sections.guests}</h2>
                <span className="text-xs font-semibold text-muted-foreground">
                  {t.counts.seatedGuests(state.guests.length - unseatedGuests.length, state.guests.length)}
                </span>
              </div>
              <form className="grid gap-2.5" onSubmit={addGuest}>
                <Input
                  placeholder={t.fields.name}
                  value={newGuest.name}
                  onChange={(event) => setNewGuest({ ...newGuest, name: event.target.value })}
                />
                <Input
                  placeholder={t.fields.group}
                  list="guest-groups"
                  value={newGuest.group}
                  onChange={(event) => setNewGuest({ ...newGuest, group: event.target.value })}
                />
                <Input
                  placeholder={t.fields.dietary}
                  value={newGuest.dietary}
                  onChange={(event) => setNewGuest({ ...newGuest, dietary: event.target.value })}
                />
                <Button type="submit">{t.actions.addGuest}</Button>
              </form>
              <datalist id="guest-groups">
                {groups.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
              <div className="mt-3 grid gap-2.5 border-t border-border pt-3">
                <Label className="relative inline-flex min-h-9 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border bg-background text-sm font-bold transition-colors hover:border-primary hover:text-primary">
                  <Input className="absolute inset-0 h-full opacity-0" accept=".csv,text/csv" type="file" onChange={handleCsvFile} />
                  {t.actions.chooseCsv}
                </Label>
                <Textarea
                  className="min-h-24 resize-y"
                  rows={4}
                  placeholder={t.csvPlaceholder}
                  value={csvText}
                  onChange={(event) => setCsvText(event.target.value)}
                />
                <Button className="w-full" type="button" onClick={importGuestsFromCsv}>
                  {t.actions.importGuests}
                </Button>
              </div>
            </SidebarGroup>

            <SidebarGroup className="min-h-56 p-4 sm:p-5">
              <div className="mb-3.5 flex items-baseline justify-between">
                <h2 className="m-0 text-sm leading-tight font-semibold">{t.sections.unseated}</h2>
                <span className="text-xs font-semibold text-muted-foreground">{unseatedGuests.length}</span>
              </div>
              <Button className="mb-3 w-full" type="button" onClick={autoSeatByGroup} disabled={unseatedGuests.length === 0}>
                {t.actions.seatByGroup}
              </Button>
              <div className="grid max-h-96 flex-auto gap-2.5 overflow-auto pr-1">
                {unseatedGuests.length === 0 ? (
                  <p className="m-0 text-sm text-muted-foreground">{t.empty.allGuestsSeated}</p>
                ) : (
                  unseatedGuests.map((guest) => (
                    <GuestChip key={guest.id} guest={guest} onEdit={openGuestEditor} onRemove={removeGuest} />
                  ))
                )}
              </div>
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="max-h-screen overflow-auto bg-canvas p-4 lg:p-5 max-lg:max-h-none md:peer-data-[collapsible=offcanvas]:ml-0">
          <div className="mb-5 grid items-start gap-3 md:grid-cols-[1fr_minmax(0,48rem)_1fr]">
            <div className="flex min-w-0 justify-start">
              <FloatingSidebarTrigger />
            </div>
            <div
              className="grid w-full max-w-3xl grid-cols-4 items-stretch overflow-hidden rounded-lg border border-border bg-background/80 max-md:max-w-none max-sm:grid-cols-2"
              aria-label={t.aria.planStatus}
            >
              <Stat label={t.stats.tables} value={state.tables.length} />
              <Stat label={t.stats.seats} value={seats.length} />
              <Stat label={t.stats.guests} value={state.guests.length} />
              <Stat label={t.stats.open} value={Math.max(0, seats.length - Object.keys(state.assignments).length)} />
            </div>
            <div className="flex min-w-0 justify-end gap-2">
              <LanguageControl
                currentLabel={t.language.current}
                label={t.aria.language}
                nextLabel={t.language.next}
                onToggle={() => setLocale(locale === "it" ? "en" : "it")}
              />
              <ShareControl
                copied={shareCopied}
                isOpen={shareOpen}
                onCopy={copyShareLink}
                onToggle={() => {
                  setShareOpen((current) => !current);
                  setShareUrl(createShareUrl(state));
                  setShareCopied(false);
                }}
                t={t}
                url={shareUrl || createShareUrl(state)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2 2xl:grid-cols-3">
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
                t={t}
              />
            ))}
          </div>
        </SidebarInset>
      </SidebarProvider>

      {seatModal && modalSeat && (
        <SeatAssignmentModal
          assignedGuest={modalAssignedGuest}
          assignments={state.assignments}
          guests={state.guests}
          onAssignGuest={assignGuestToSeat}
          onClearSeat={clearSeat}
          onClose={() => setSeatModal(null)}
          onCreateGuest={createGuestForSeat}
          onEditGuest={openGuestEditor}
          onQueryChange={(query) => setSeatModal((current) => (current ? { ...current, query } : current))}
          seat={modalSeat}
          seatById={seatById}
          seatedGuestIds={seatedGuestIds}
          seatModal={seatModal}
          table={modalTable}
          tables={state.tables}
          t={t}
        />
      )}

      {guestModal && (
        <GuestEditModal
          guestModal={guestModal}
          onChange={(nextGuestModal) => setGuestModal(nextGuestModal)}
          onClose={() => setGuestModal(null)}
          onSave={saveGuest}
          t={t}
        />
      )}
    </div>
  );
}

function FloatingSidebarTrigger() {
  const { isMobile, open, openMobile } = useSidebar();
  if (isMobile ? openMobile : open) return null;

  return <SidebarTrigger className="sticky top-4 z-30 flex-none bg-background shadow-sm [&>svg]:size-3.5 md:fixed md:top-4 md:left-4" />;
}

function ShareControl({
  copied,
  isOpen,
  onCopy,
  onToggle,
  t,
  url,
}: {
  copied: boolean;
  isOpen: boolean;
  onCopy: (input: HTMLInputElement | null) => void;
  onToggle: () => void;
  t: Messages;
  url: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex min-w-0 justify-end">
      <Button aria-expanded={isOpen} aria-label={t.aria.sharePlan} size="icon" type="button" variant="outline" onClick={onToggle}>
        <Share2 aria-hidden="true" className="size-3.5" />
      </Button>
      {isOpen ? (
        <div className="absolute top-11 right-0 z-30 grid w-[min(22rem,calc(100vw-2rem))] gap-2 rounded-lg border border-border bg-background p-3 shadow-xl md:top-[4.5rem]">
          <Input aria-label={t.aria.shareLink} readOnly ref={inputRef} value={url} onFocus={(event) => event.currentTarget.select()} />
          <Button className="w-full" type="button" onClick={() => onCopy(inputRef.current)}>
            {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
            {copied ? t.actions.copied : t.actions.copyLink}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function LanguageControl({
  currentLabel,
  label,
  nextLabel,
  onToggle,
}: {
  currentLabel: string;
  label: string;
  nextLabel: string;
  onToggle: () => void;
}) {
  return (
    <Button aria-label={label} className="relative" title={nextLabel} size="icon" type="button" variant="outline" onClick={onToggle}>
      <Languages aria-hidden="true" className="size-3.5" />
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="absolute -right-1 -bottom-1 rounded-sm border border-border bg-background px-1 text-[10px] font-black leading-4">
        {currentLabel}
      </span>
    </Button>
  );
}

function createShareUrl(state: PlannerState) {
  const url = new URL(window.location.href);
  url.searchParams.set(STATE_QUERY_KEY, encodeState(state));
  url.searchParams.delete(LEGACY_STATE_QUERY_KEY);
  return url.href;
}

function createDuplicateTableName(name: string, tables: WeddingTable[], copySuffix: string) {
  const baseName = `${name} ${copySuffix}`;
  const existingNames = new Set(tables.map((table) => table.name.trim()));
  if (!existingNames.has(baseName)) return baseName;

  let copyNumber = 2;
  while (existingNames.has(`${baseName} ${copyNumber}`)) {
    copyNumber += 1;
  }
  return `${baseName} ${copyNumber}`;
}
