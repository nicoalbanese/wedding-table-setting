import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from "react";

type TableShape = "round" | "rectangular";
type SeatSide = "top" | "right" | "bottom" | "left" | "ring";

type Guest = {
  id: string;
  name: string;
  group: string;
  dietary: string;
};

type LegacyGuest = Omit<Guest, "dietary"> & {
  dietary?: string;
  notes?: string;
};

type WeddingTable = {
  id: string;
  name: string;
  shape: TableShape;
  roundSeats: number;
  topSeats: number;
  rightSeats: number;
  bottomSeats: number;
  leftSeats: number;
};

type Seat = {
  id: string;
  tableId: string;
  side: SeatSide;
  index: number;
  label: string;
};

type PlannerState = {
  tables: WeddingTable[];
  guests: Guest[];
  assignments: Record<string, string>;
};

type LegacyPlannerState = Omit<PlannerState, "guests"> & {
  guests: LegacyGuest[];
};

type DietaryBadgeDefinition = {
  code: string;
  label: string;
  className: string;
  patterns: RegExp[];
};

type SeatModalState = {
  seatId: string;
  query: string;
} | null;

type NewGuestForm = {
  name: string;
  group: string;
  dietary: string;
};

const STATE_QUERY_KEY = "state";

const dietaryBadgeDefinitions: DietaryBadgeDefinition[] = [
  {
    code: "Ve",
    label: "Vegetarian",
    className: "vegetarian",
    patterns: [/\bvegetarian\b/i, /\bveggie\b/i, /^ve$/i],
  },
  {
    code: "Vg",
    label: "Vegan",
    className: "vegan",
    patterns: [/\bvegan\b/i, /^vg$/i],
  },
  {
    code: "Ce",
    label: "Celiac",
    className: "celiac",
    patterns: [/\bceliac\b/i, /\bcoeliac\b/i, /^ce$/i],
  },
  {
    code: "GF",
    label: "Gluten free",
    className: "gluten-free",
    patterns: [/\bgluten[-\s]?free\b/i, /\bno gluten\b/i],
  },
  {
    code: "Nu",
    label: "Nut allergy",
    className: "nut",
    patterns: [/\bnut allergy\b/i, /\bnuts?\b/i, /\bpeanut\b/i],
  },
  {
    code: "Da",
    label: "Dairy free",
    className: "dairy",
    patterns: [/\bdairy[-\s]?free\b/i, /\bno dairy\b/i, /\blactose\b/i],
  },
  {
    code: "Ha",
    label: "Halal",
    className: "halal",
    patterns: [/\bhalal\b/i],
  },
  {
    code: "Ko",
    label: "Kosher",
    className: "kosher",
    patterns: [/\bkosher\b/i],
  },
];

const starterState: PlannerState = {
  tables: [
    {
      id: "table-1",
      name: "Top Table",
      shape: "rectangular",
      roundSeats: 8,
      topSeats: 0,
      rightSeats: 6,
      bottomSeats: 0,
      leftSeats: 6,
    },
    {
      id: "table-2",
      name: "Table 2",
      shape: "rectangular",
      roundSeats: 8,
      topSeats: 0,
      rightSeats: 6,
      bottomSeats: 0,
      leftSeats: 6,
    },
  ],
  guests: [],
  assignments: {},
};

export function App() {
  const [state, setState] = useState<PlannerState>(() => loadStateFromUrl() ?? starterState);
  const [seatModal, setSeatModal] = useState<SeatModalState>(null);
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
    setState((current) => {
      return { ...current, tables: [...current.tables, table] };
    });
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
  const modalGuests = state.guests
    .filter((guest) => {
      const query = seatModal?.query.trim().toLowerCase() ?? "";
      if (!query) return true;
      return [guest.name, guest.group, guest.dietary].some((value) => value.toLowerCase().includes(query));
    })
    .sort((a, b) => Number(seatedGuestIds.has(a.id)) - Number(seatedGuestIds.has(b.id)) || a.name.localeCompare(b.name));

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
              <button className="add-table-button" type="button" onClick={addTable}>
                + Add Table
              </button>
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
              <input
                placeholder="Name"
                value={newGuest.name}
                onChange={(event) => setNewGuest({ ...newGuest, name: event.target.value })}
              />
              <input
                placeholder="Group"
                list="guest-groups"
                value={newGuest.group}
                onChange={(event) => setNewGuest({ ...newGuest, group: event.target.value })}
              />
              <input
                placeholder="Dietary"
                value={newGuest.dietary}
                onChange={(event) => setNewGuest({ ...newGuest, dietary: event.target.value })}
              />
              <button className="button primary" type="submit">
                Add Guest
              </button>
            </form>
            <datalist id="guest-groups">
              {groups.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
            <div className="csv-import">
              <label className="file-input">
                <input accept=".csv,text/csv" type="file" onChange={handleCsvFile} />
                Choose CSV
              </label>
              <textarea
                rows={4}
                placeholder="name,group,dietary&#10;Alice Smith,Family,Vegetarian"
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
              />
              <button className="button secondary" type="button" onClick={importGuestsFromCsv}>
                Import Guests
              </button>
            </div>
          </section>

          <section className="panel guest-pool">
            <div className="section-heading">
              <h2>Unseated</h2>
              <span>{unseatedGuests.length}</span>
            </div>
            <button className="button primary full" type="button" onClick={autoSeatByGroup} disabled={unseatedGuests.length === 0}>
              Seat by Group
            </button>
            <div className="guest-list">
              {unseatedGuests.length === 0 ? (
                <p className="empty-copy">All guests have seats.</p>
              ) : (
                unseatedGuests.map((guest) => <GuestChip key={guest.id} guest={guest} onRemove={removeGuest} />)
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
              <button className="button secondary" type="button" onClick={exportCsv}>
                Export CSV
              </button>
              <button className="button danger" type="button" onClick={resetPlanner}>
                Reset
              </button>
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
        <div className="modal-backdrop" onMouseDown={() => setSeatModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">{modalTable?.name}</p>
                <h2>{modalSeat.label}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setSeatModal(null)}>
                x
              </button>
            </div>
            {modalAssignedGuest && (
              <div className="current-seat">
                <span>
                  {modalAssignedGuest.name}
                  {modalAssignedGuest.group ? <small>{modalAssignedGuest.group}</small> : null}
                </span>
                <DietaryBadges dietary={modalAssignedGuest.dietary} />
                <button className="button secondary" type="button" onClick={() => clearSeat(modalSeat.id)}>
                  Clear Seat
                </button>
              </div>
            )}
            <input
              autoFocus
              className="search-input"
              placeholder="Search guests"
              value={seatModal.query}
              onChange={(event) => setSeatModal({ ...seatModal, query: event.target.value })}
            />
            <div className="modal-guest-list">
              {modalGuests.map((guest) => {
                const seatedAt = findSeatForGuest(state.assignments, guest.id);
                const seatedSeat = seatedAt ? seatById.get(seatedAt) : undefined;
                const seatedTable = seatedSeat ? state.tables.find((table) => table.id === seatedSeat.tableId) : undefined;
                return (
                  <button className="guest-option" key={guest.id} type="button" onClick={() => assignGuestToSeat(guest.id, modalSeat.id)}>
                    <span>
                      {guest.name}
                      {guest.group ? <small>{guest.group}</small> : null}
                    </span>
                    <DietaryBadges dietary={guest.dietary} />
                    <em>{seatedSeat ? `${seatedTable?.name}, ${seatedSeat.label}` : "Unseated"}</em>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TableEditor({
  canRemove,
  isOpen,
  onChange,
  onRemove,
  onToggle,
  table,
}: {
  canRemove: boolean;
  isOpen: boolean;
  onChange: (patch: Partial<WeddingTable>) => void;
  onRemove: () => void;
  onToggle: (isOpen: boolean) => void;
  table: WeddingTable;
}) {
  return (
    <details className="table-editor" open={isOpen} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>
        <span>{table.name}</span>
        <div className="table-summary-actions">
          <em>{createSeatsForTable(table).length} seats</em>
          <button
            aria-label={`Remove ${table.name}`}
            className="remove-table-button"
            disabled={!canRemove}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }}
            type="button"
          >
            x
          </button>
        </div>
      </summary>
      <div className="editor-fields">
        <label className="field">
          <span>Name</span>
          <input value={table.name} onChange={(event) => onChange({ name: event.target.value })} />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={table.shape} onChange={(event) => onChange({ shape: event.target.value as TableShape })}>
            <option value="round">Round</option>
            <option value="rectangular">Rectangular</option>
          </select>
        </label>

        {table.shape === "round" ? (
          <label className="field">
            <span>Total seats</span>
            <input
              min={1}
              max={24}
              type="number"
              value={table.roundSeats}
              onChange={(event) => onChange({ roundSeats: clamp(Number(event.target.value), 1, 24) })}
            />
          </label>
        ) : (
          <>
            <div className="side-grid">
              <NumberField label="Top" value={table.topSeats} onChange={(topSeats) => onChange({ topSeats })} />
              <NumberField label="Right" value={table.rightSeats} onChange={(rightSeats) => onChange({ rightSeats })} />
              <NumberField label="Bottom" value={table.bottomSeats} onChange={(bottomSeats) => onChange({ bottomSeats })} />
              <NumberField label="Left" value={table.leftSeats} onChange={(leftSeats) => onChange({ leftSeats })} />
            </div>
          </>
        )}
      </div>
    </details>
  );
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <label className="field compact">
      <span>{label}</span>
      <input min={0} max={20} type="number" value={value} onChange={(event) => onChange(clamp(Number(event.target.value), 0, 20))} />
    </label>
  );
}

function TableView({
  assignments,
  guestById,
  onClearSeat,
  onClearTable,
  onRename,
  onOpenSeat,
  onSeatDrop,
  table,
}: {
  assignments: Record<string, string>;
  guestById: Map<string, Guest>;
  onClearSeat: (seatId: string) => void;
  onClearTable: () => void;
  onRename: (name: string) => void;
  onOpenSeat: (seatId: string) => void;
  onSeatDrop: (event: DragEvent<HTMLButtonElement>, seatId: string) => void;
  table: WeddingTable;
}) {
  const seats = createSeatsForTable(table);
  const assignedCount = seats.filter((seat) => assignments[seat.id]).length;
  const topSeats = seats.filter((seat) => seat.side === "top");
  const leftSeats = seats.filter((seat) => seat.side === "left");
  const rightSeats = seats.filter((seat) => seat.side === "right");
  const bottomSeats = seats.filter((seat) => seat.side === "bottom");

  return (
    <article className={`table-card ${table.shape}`}>
      <div className="table-title">
        <input
          aria-label={`Name for ${table.name}`}
          className="table-name-input"
          value={table.name}
          onChange={(event) => onRename(event.target.value)}
        />
        <div className="table-actions">
          <span>
            {assignedCount}/{seats.length}
          </span>
          <button className="table-reset-button" type="button" onClick={onClearTable} disabled={assignedCount === 0}>
            Unseat Table
          </button>
        </div>
      </div>
      {table.shape === "round" ? (
        <div className="round-layout">
          <div className="round-table-label">Round</div>
          {seats.map((seat, index) => (
            <SeatButton
              assignment={assignments[seat.id]}
              guest={guestById.get(assignments[seat.id])}
              key={seat.id}
              onClear={onClearSeat}
              onDrop={onSeatDrop}
              onOpen={onOpenSeat}
              seat={seat}
              style={getRoundSeatStyle(index, seats.length)}
            />
          ))}
        </div>
      ) : (
        <div className="rectangle-layout">
          {topSeats.length > 0 && (
            <div className="seat-row top">
              {topSeats.map((seat) => (
                <SeatButton
                  assignment={assignments[seat.id]}
                  guest={guestById.get(assignments[seat.id])}
                  key={seat.id}
                  onClear={onClearSeat}
                  onDrop={onSeatDrop}
                  onOpen={onOpenSeat}
                  seat={seat}
                />
              ))}
            </div>
          )}
          <div className="middle-row">
            <div className="seat-column">
              {leftSeats.map((seat) => (
                  <SeatButton
                    assignment={assignments[seat.id]}
                    guest={guestById.get(assignments[seat.id])}
                    key={seat.id}
                    onClear={onClearSeat}
                    onDrop={onSeatDrop}
                    onOpen={onOpenSeat}
                    seat={seat}
                  />
                ))}
            </div>
            <div className="rect-table-label">Table</div>
            <div className="seat-column">
              {rightSeats.map((seat) => (
                  <SeatButton
                    assignment={assignments[seat.id]}
                    guest={guestById.get(assignments[seat.id])}
                    key={seat.id}
                    onClear={onClearSeat}
                    onDrop={onSeatDrop}
                    onOpen={onOpenSeat}
                    seat={seat}
                  />
                ))}
            </div>
          </div>
          {bottomSeats.length > 0 && (
            <div className="seat-row bottom">
              {bottomSeats.map((seat) => (
                <SeatButton
                  assignment={assignments[seat.id]}
                  guest={guestById.get(assignments[seat.id])}
                  key={seat.id}
                  onClear={onClearSeat}
                  onDrop={onSeatDrop}
                  onOpen={onOpenSeat}
                  seat={seat}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SeatButton({
  assignment,
  guest,
  onClear,
  onDrop,
  onOpen,
  seat,
  style,
}: {
  assignment?: string;
  guest?: Guest;
  onClear: (seatId: string) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>, seatId: string) => void;
  onOpen: (seatId: string) => void;
  seat: Seat;
  style?: React.CSSProperties;
}) {
  return (
    <button
      className={`seat ${guest ? "occupied" : ""}`}
      draggable={Boolean(guest)}
      onClick={() => onOpen(seat.id)}
      onDragOver={(event) => event.preventDefault()}
      onDragStart={(event) => {
        if (!assignment) return;
        event.dataTransfer.setData("application/x-guest-id", assignment);
      }}
      onDrop={(event) => onDrop(event, seat.id)}
      style={style}
      title={guest ? [guest.name, seat.label, guest.dietary].filter(Boolean).join(" - ") : seat.label}
      type="button"
    >
      <span className="seat-name">{guest?.name ?? "+"}</span>
      {guest ? <DietaryBadges dietary={guest.dietary} compact /> : null}
      {guest && (
        <em
          onClick={(event) => {
            event.stopPropagation();
            onClear(seat.id);
          }}
        >
          x
        </em>
      )}
    </button>
  );
}

function GuestChip({ guest, onRemove }: { guest: Guest; onRemove: (guestId: string) => void }) {
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
      <button type="button" aria-label={`Remove ${guest.name}`} onClick={() => onRemove(guest.id)}>
        x
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function DietaryBadges({ compact = false, dietary }: { compact?: boolean; dietary: string }) {
  const badges = getDietaryBadges(dietary);
  if (badges.length === 0) return null;

  return (
    <div className={`dietary-badges ${compact ? "compact" : ""}`} aria-label={`Dietary: ${dietary}`}>
      {badges.slice(0, compact ? 2 : 4).map((badge) => (
        <span className={`dietary-badge ${badge.className}`} key={badge.code} title={dietary.trim()}>
          {badge.code}
        </span>
      ))}
    </div>
  );
}

function createDefaultTable(number: number): WeddingTable {
  return {
    id: createId("table"),
    name: `Table ${number}`,
    shape: "rectangular",
    roundSeats: 8,
    topSeats: 0,
    rightSeats: 6,
    bottomSeats: 0,
    leftSeats: 6,
  };
}

function createSeatsForTable(table: WeddingTable): Seat[] {
  if (table.shape === "round") {
    return Array.from({ length: table.roundSeats }, (_, index) => ({
      id: `${table.id}:ring:${index + 1}`,
      tableId: table.id,
      side: "ring" as const,
      index: index + 1,
      label: `Seat ${index + 1}`,
    }));
  }

  const seats: Seat[] = [];
  addSideSeats(seats, table, "top", table.topSeats, "Top");
  addSideSeats(seats, table, "left", table.leftSeats, "Left");
  addSideSeats(seats, table, "right", table.rightSeats, "Right");
  addSideSeats(seats, table, "bottom", table.bottomSeats, "Bottom");
  return seats;
}

function addSideSeats(seats: Seat[], table: WeddingTable, side: SeatSide, count: number, label: string) {
  for (let index = 1; index <= count; index += 1) {
    seats.push({
      id: `${table.id}:${side}:${index}`,
      tableId: table.id,
      side,
      index,
      label: `${label} ${index}`,
    });
  }
}

function getRoundSeatStyle(index: number, total: number): React.CSSProperties {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const radius = 42;
  const x = 50 + Math.cos(angle) * radius;
  const y = 50 + Math.sin(angle) * radius;
  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: "translate(-50%, -50%)",
  };
}

function findSeatForGuest(assignments: Record<string, string>, guestId: string) {
  return Object.entries(assignments).find(([, assignedGuestId]) => assignedGuestId === guestId)?.[0];
}

function sanitizeAssignments(state: PlannerState): PlannerState {
  const validSeatIds = new Set(state.tables.flatMap(createSeatsForTable).map((seat) => seat.id));
  const validGuestIds = new Set(state.guests.map((guest) => guest.id));
  const assignments: Record<string, string> = {};
  for (const [seatId, guestId] of Object.entries(state.assignments)) {
    if (validSeatIds.has(seatId) && validGuestIds.has(guestId)) {
      assignments[seatId] = guestId;
    }
  }
  return { ...state, assignments };
}

function groupGuests(guests: Guest[]) {
  const groups = new Map<string, Guest[]>();
  for (const guest of guests) {
    const group = guest.group.trim() || "Ungrouped";
    groups.set(group, [...(groups.get(group) ?? []), guest]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([, groupGuests]) => groupGuests.sort((a, b) => a.name.localeCompare(b.name)));
}

function getDietaryBadges(dietary: string) {
  const value = dietary.trim();
  if (!value) return [];

  const matchesByCode = new Map<string, Omit<DietaryBadgeDefinition, "patterns">>();
  const dietaryParts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  let hasUnmatchedPart = false;

  for (const part of dietaryParts.length > 0 ? dietaryParts : [value]) {
    const partMatches = dietaryBadgeDefinitions.filter((definition) => definition.patterns.some((pattern) => pattern.test(part)));
    if (partMatches.length === 0) {
      hasUnmatchedPart = true;
    }
    for (const match of partMatches) {
      matchesByCode.set(match.code, match);
    }
  }

  const matches = [...matchesByCode.values()];
  if (matches.length > 0 && !hasUnmatchedPart) return matches;
  if (matches.length > 0 && hasUnmatchedPart) {
    return [
      ...matches,
      {
        code: "Di",
        label: "Dietary note",
        className: "other",
      },
    ];
  }

  return [
    {
      code: "Di",
      label: "Dietary note",
      className: "other",
    },
  ];
}

function parseGuestsCsv(text: string): Omit<Guest, "id">[] {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length === 0) return [];

  const firstRow = rows[0].map((cell) => cell.trim().toLowerCase());
  const hasHeaders = firstRow.includes("name");
  const headers = hasHeaders ? firstRow : ["name", "group", "dietary"];
  const dataRows = hasHeaders ? rows.slice(1) : rows;
  const nameIndex = Math.max(0, headers.indexOf("name"));
  const groupIndex = headers.indexOf("group");
  const dietaryIndex = headers.indexOf("dietary");
  const notesIndex = headers.indexOf("notes");

  return dataRows
    .map((row) => ({
      name: row[nameIndex]?.trim() ?? "",
      group: groupIndex >= 0 ? row[groupIndex]?.trim() ?? "" : "",
      dietary: dietaryIndex >= 0 ? row[dietaryIndex]?.trim() ?? "" : notesIndex >= 0 ? row[notesIndex]?.trim() ?? "" : "",
    }))
    .filter((guest) => guest.name);
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function encodeState(state: PlannerState) {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeState(encoded: string): PlannerState | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as LegacyPlannerState;
    if (!Array.isArray(parsed.tables) || !Array.isArray(parsed.guests) || typeof parsed.assignments !== "object") return null;
    return sanitizeAssignments(normalizePlannerState(parsed));
  } catch {
    return null;
  }
}

function normalizePlannerState(state: LegacyPlannerState): PlannerState {
  return {
    ...state,
    guests: state.guests.map(({ notes, ...guest }) => ({
      ...guest,
      dietary: guest.dietary ?? notes ?? "",
    })),
  };
}

function loadStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(STATE_QUERY_KEY);
  return encoded ? decodeState(encoded) : null;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function escapeCsvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
