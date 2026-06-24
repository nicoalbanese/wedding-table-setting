"use client";

import { type CSSProperties, ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Download, Languages, Lock, Plus, Save, Share2 } from "lucide-react";

import { GuestChip } from "@/components/guest-chip";
import { GuestEditModal } from "@/components/guest-edit-modal";
import { SeatAssignmentModal } from "@/components/seat-assignment-modal";
import { SidebarSection } from "@/components/sidebar-section";
import { Stat } from "@/components/stat";
import { TableEditor } from "@/components/table-editor";
import { TableView } from "@/components/table-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { type Messages, useI18n } from "@/i18n";
import { createStarterState, LEGACY_STATE_QUERY_KEY, STATE_QUERY_KEY, TABLE_DRAG_MIME } from "@/planner/constants";
import { createDefaultOpenSidebarSectionIds, type SidebarSectionId } from "@/planner/sidebar-sections";
import type { Guest, GuestEditModalState, NewGuestForm, PlannerState, SeatModalState, WeddingTable } from "@/planner/types";
import {
  createDefaultTable,
  createId,
  createSeatsForTable,
  createSeatConfigurationCsv,
  encodeState,
  findSeatForGuest,
  groupGuests,
  loadStateFromUrl,
  parseGuestsCsv,
  sanitizeAssignments,
} from "@/planner/utils";

type PersistedPlan = {
  createdAt: string;
  id: string;
  name: string;
  protected: boolean;
  rev: number;
  state: PlannerState;
  updatedAt: string;
};

type PersistenceStatus = "idle" | "loading" | "saving" | "saved" | "conflict" | "error" | "password-required";

type PlannerDraft = {
  baseRev: number | null;
  name: string;
  planId: string | null;
  state: PlannerState;
  updatedAt: string;
  version: 1;
};

export type InitialPlanLoad =
  | { status: "available"; plan: PersistedPlan }
  | { status: "password-required" }
  | { status: "not-found" }
  | { status: "store-not-configured" };

export function App({
  initialPlanLoad,
  initialState,
  planId,
}: {
  initialPlanLoad?: InitialPlanLoad;
  initialState?: PlannerState;
  planId?: string;
}) {
  const { locale, setLocale, t } = useI18n();
  const [state, setState] = useState<PlannerState>(() =>
    initialPlanLoad?.status === "available"
      ? initialPlanLoad.plan.state
      : initialState ?? (planId ? createStarterState(t.defaults) : loadStateFromUrl() ?? createStarterState(t.defaults)),
  );
  const [seatModal, setSeatModal] = useState<SeatModalState>(null);
  const [guestModal, setGuestModal] = useState<GuestEditModalState>(null);
  const [csvText, setCsvText] = useState("");
  const [newGuest, setNewGuest] = useState<NewGuestForm>({ name: "", group: "", dietary: "" });
  const [openTableEditorIds, setOpenTableEditorIds] = useState<Set<string>>(() => new Set());
  const [openSidebarSectionIds, setOpenSidebarSectionIds] = useState<Set<SidebarSectionId>>(() => createDefaultOpenSidebarSectionIds(state));
  const [sidebarSectionsTouched, setSidebarSectionsTouched] = useState(false);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [tableDropTargetId, setTableDropTargetId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [remotePlan, setRemotePlan] = useState<PersistedPlan | null>(() =>
    initialPlanLoad?.status === "available" ? initialPlanLoad.plan : null,
  );
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(() =>
    initialPlanLoad?.status === "available" ? createSavedSnapshot(initialPlanLoad.plan.state, initialPlanLoad.plan.name) : null,
  );
  const [createPassword, setCreatePassword] = useState("");
  const [planName, setPlanName] = useState(() =>
    initialPlanLoad?.status === "available" ? initialPlanLoad.plan.name : getDefaultPlanName(),
  );
  const [linkSlug, setLinkSlug] = useState(() =>
    initialPlanLoad?.status === "available" ? initialPlanLoad.plan.id : createPlanSlug(getDefaultPlanName()),
  );
  const [linkSlugEdited, setLinkSlugEdited] = useState(false);
  const [planPassword, setPlanPassword] = useState("");
  const [nextPlanPassword, setNextPlanPassword] = useState("");
  const [clearPlanPassword, setClearPlanPassword] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>(() => resolveInitialPersistenceStatus(planId, initialPlanLoad));
  const [persistenceError, setPersistenceError] = useState(() => resolveInitialPersistenceError(initialPlanLoad));
  const [conflictPlan, setConflictPlan] = useState<PersistedPlan | null>(null);
  const [draftCheckedKey, setDraftCheckedKey] = useState<string | null>(null);

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
  const currentPlanId = remotePlan?.id ?? planId;
  const currentSnapshot = useMemo(() => createSavedSnapshot(state, planName), [planName, state]);
  const hasRemotePlan = Boolean(remotePlan);
  const hasContentChanges = hasRemotePlan && savedSnapshot !== null && currentSnapshot !== savedSnapshot;
  const hasPasswordChange = Boolean(remotePlan && (nextPlanPassword.trim() || (remotePlan.protected && clearPlanPassword)));
  const isDirty = hasContentChanges || hasPasswordChange;
  const isBusy = persistenceStatus === "loading" || persistenceStatus === "saving";
  const normalizedLinkSlug = useMemo(() => createPlanSlug(linkSlug || planName), [linkSlug, planName]);
  const activeDraftKey = useMemo(() => createPlannerDraftKey(currentPlanId), [currentPlanId]);

  useEffect(() => {
    if (draftCheckedKey === activeDraftKey) return;
    if (currentPlanId && !remotePlan) return;

    const draft = !currentPlanId && hasUrlStateQuery() ? null : readPlannerDraft(currentPlanId, remotePlan?.rev ?? null);
    if (draft) {
      setPlanName(draft.name);
      setState(draft.state);
      setNextPlanPassword("");
      setClearPlanPassword(false);
    }
    setDraftCheckedKey(activeDraftKey);
  }, [activeDraftKey, currentPlanId, draftCheckedKey, remotePlan]);

  useEffect(() => {
    if (draftCheckedKey !== activeDraftKey) return;
    if (currentPlanId && !remotePlan) return;

    if (currentPlanId) {
      if (isDirty) {
        writePlannerDraft(currentPlanId, {
          baseRev: remotePlan?.rev ?? null,
          name: planName,
          state,
        });
      } else {
        clearPlannerDraft(currentPlanId);
      }
      return;
    }

    writePlannerDraft(null, {
      baseRev: null,
      name: planName,
      state,
    });
  }, [activeDraftKey, currentPlanId, draftCheckedKey, isDirty, planName, remotePlan, state]);

  useEffect(() => {
    if (currentPlanId) return;

    const url = new URL(window.location.href);
    const encoded = encodeState(state);
    if (url.searchParams.get(STATE_QUERY_KEY) !== encoded) {
      url.searchParams.set(STATE_QUERY_KEY, encoded);
      url.searchParams.delete(LEGACY_STATE_QUERY_KEY);
      window.history.replaceState(null, "", url);
    }
  }, [currentPlanId, state]);

  useEffect(() => {
    setState((current) => sanitizeAssignments(current));
  }, [seats]);

  useEffect(() => {
    if (!planId || initialPlanLoad) return;

    loadPersistedPlan();
    // We only want the route id to trigger initial remote loading. Password retries call loadPersistedPlan directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlanLoad, planId]);

  useEffect(() => {
    if (sidebarSectionsTouched) return;
    setOpenSidebarSectionIds(createDefaultOpenSidebarSectionIds(state));
  }, [sidebarSectionsTouched, state]);

  useEffect(() => {
    if (!shareOpen) return;

    setShareUrl(createShareUrl(state, currentPlanId));
    setShareCopied(false);
  }, [currentPlanId, shareOpen, state]);

  useEffect(() => {
    if (currentPlanId || linkSlugEdited) return;
    setLinkSlug(createEditablePlanSlug(planName));
  }, [currentPlanId, linkSlugEdited, planName]);

  useEffect(() => {
    if (!isDirty) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  async function loadPersistedPlan(password = planPassword) {
    if (!planId) return;

    setPersistenceStatus("loading");
    setPersistenceError("");
    setConflictPlan(null);

    const response = await fetch(`/api/plans/${encodeURIComponent(planId)}`, {
      cache: "no-store",
      headers: password ? { "x-plan-password": password } : undefined,
    });
    const payload = (await response.json().catch(() => null)) as PersistedPlan | { error?: string } | null;

    if (response.status === 401) {
      setPersistenceStatus("password-required");
      setPersistenceError("");
      return;
    }

    if (!response.ok || !isPersistedPlan(payload)) {
      setPersistenceStatus("error");
      setPersistenceError(resolvePersistenceError(getApiError(payload), "Could not load this saved plan."));
      return;
    }

    setRemotePlan(payload);
    setPlanName(payload.name);
    setLinkSlug(payload.id);
    setState(payload.state);
    setSavedSnapshot(createSavedSnapshot(payload.state, payload.name));
    setNextPlanPassword("");
    setClearPlanPassword(false);
    setPersistenceStatus("saved");
    setPersistenceError("");
  }

  async function createPersistedPlan() {
    const id = normalizedLinkSlug;
    if (!id) {
      setPersistenceStatus("error");
      setPersistenceError("Choose a valid link name before saving.");
      setShareOpen(true);
      return;
    }

    setPersistenceStatus("saving");
    setPersistenceError("");
    setConflictPlan(null);

    const response = await fetch("/api/plans", {
      body: JSON.stringify({ id, name: planName, password: createPassword, state }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as PersistedPlan | { error?: string } | null;

    if (!response.ok || !isPersistedPlan(payload)) {
      setPersistenceStatus("error");
      setPersistenceError(resolvePersistenceError(getApiError(payload), "Could not create a saved plan."));
      return;
    }

    setRemotePlan(payload);
    setPlanName(payload.name);
    setLinkSlug(payload.id);
    setLinkSlugEdited(false);
    setPlanPassword(createPassword);
    setCreatePassword("");
    setSavedSnapshot(createSavedSnapshot(payload.state, payload.name));
    setPersistenceStatus("saved");
    setShareUrl(createShareUrl(payload.state, payload.id));
    clearPlannerDraft(null);
    clearPlannerDraft(payload.id);
    replaceUrlWithPlanId(payload.id);
  }

  async function savePersistedPlan() {
    if (!remotePlan) return;

    setPersistenceStatus("saving");
    setPersistenceError("");
    setConflictPlan(null);

    const response = await fetch(`/api/plans/${encodeURIComponent(remotePlan.id)}`, {
      body: JSON.stringify({
        baseRev: remotePlan.rev,
        clearPassword: clearPlanPassword,
        name: planName,
        nextPassword: nextPlanPassword,
        password: planPassword,
        state,
      }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
    const payload = (await response.json().catch(() => null)) as PersistedPlan | { latest?: PersistedPlan; error?: string } | null;

    if (response.status === 409 && payload && "latest" in payload && payload.latest) {
      setConflictPlan(payload.latest);
      setPersistenceStatus("conflict");
      setPersistenceError("The stored plan changed since you loaded it.");
      return;
    }

    if (!response.ok || !isPersistedPlan(payload)) {
      setPersistenceStatus("error");
      setPersistenceError(resolvePersistenceError(getApiError(payload), "Could not save this plan."));
      return;
    }

    setRemotePlan(payload);
    setPlanName(payload.name);
    setLinkSlug(payload.id);
    setPlanPassword(payload.protected ? nextPlanPassword.trim() || planPassword : "");
    setNextPlanPassword("");
    setClearPlanPassword(false);
    setSavedSnapshot(createSavedSnapshot(payload.state, payload.name));
    setPersistenceStatus("saved");
    setShareUrl(createShareUrl(payload.state, payload.id));
    clearPlannerDraft(payload.id);
  }

  function loadConflictPlan() {
    if (!conflictPlan) return;
    setRemotePlan(conflictPlan);
    setPlanName(conflictPlan.name);
    setLinkSlug(conflictPlan.id);
    setState(conflictPlan.state);
    setSavedSnapshot(createSavedSnapshot(conflictPlan.state, conflictPlan.name));
    setNextPlanPassword("");
    setClearPlanPassword(false);
    clearPlannerDraft(conflictPlan.id);
    setConflictPlan(null);
    setPersistenceStatus("saved");
    setPersistenceError("");
  }

  function updateTable(tableId: string, patch: Partial<WeddingTable>) {
    setState((current) =>
      sanitizeAssignments({
        ...current,
        tables: current.tables.map((table) => (table.id === tableId ? { ...table, ...patch } : table)),
      }),
    );
  }

  function moveTable(tableId: string, direction: -1 | 1) {
    setState((current) => {
      const sourceIndex = current.tables.findIndex((table) => table.id === tableId);
      const targetIndex = sourceIndex + direction;
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= current.tables.length) return current;

      const tables = [...current.tables];
      const [table] = tables.splice(sourceIndex, 1);
      tables.splice(targetIndex, 0, table);
      return { ...current, tables };
    });
  }

  function reorderTables(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;

    setState((current) => {
      const sourceIndex = current.tables.findIndex((table) => table.id === draggedId);
      const targetIndex = current.tables.findIndex((table) => table.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;

      const tables = [...current.tables];
      const [table] = tables.splice(sourceIndex, 1);
      tables.splice(targetIndex, 0, table);
      return { ...current, tables };
    });
  }

  function handleTableDragOver(event: DragEvent<HTMLElement>, targetId: string) {
    const isTableDrag = Array.from(event.dataTransfer.types).includes(TABLE_DRAG_MIME);
    if (!draggedTableId || draggedTableId === targetId || !isTableDrag) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setTableDropTargetId((current) => (current === targetId ? current : targetId));
  }

  function handleTableDrop(event: DragEvent<HTMLElement>, targetId: string) {
    const sourceId = event.dataTransfer.getData(TABLE_DRAG_MIME);
    if (!sourceId) return;

    event.preventDefault();
    reorderTables(sourceId, targetId);
    setDraggedTableId(null);
    setTableDropTargetId(null);
  }

  function clearTableDragState() {
    setDraggedTableId(null);
    setTableDropTargetId(null);
  }

  function toggleSidebarSection(sectionId: SidebarSectionId) {
    setSidebarSectionsTouched(true);
    setOpenSidebarSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
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
    const url = createShareUrl(state, currentPlanId);
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

  function openSharePanel() {
    setShareOpen(true);
    setShareUrl(createShareUrl(state, currentPlanId));
    setShareCopied(false);
  }

  function toggleSharePanel() {
    setShareOpen((current) => !current);
    setShareUrl(createShareUrl(state, currentPlanId));
    setShareCopied(false);
  }

  function handleSaveButtonClick() {
    if (remotePlan && isDirty && (!remotePlan.protected || planPassword.trim())) {
      void savePersistedPlan();
      return;
    }

    openSharePanel();
  }

  function exportSeatConfiguration() {
    const csv = createSeatConfigurationCsv(state, t.seats, t.defaults.table);
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${createCsvFilename(planName)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const modalSeat = seatModal ? seatById.get(seatModal.seatId) : undefined;
  const modalTable = modalSeat ? state.tables.find((table) => table.id === modalSeat.tableId) : undefined;
  const modalAssignedGuest = modalSeat ? guestById.get(state.assignments[modalSeat.id]) : undefined;

  if (planId && !remotePlan && persistenceStatus === "error") {
    return (
      <div className="grid min-h-screen min-w-80 place-items-center bg-canvas p-4 font-sans text-foreground antialiased">
        <div className="grid w-full max-w-sm gap-3 rounded-lg border border-border bg-background p-5 shadow-xl">
          <div className="grid gap-1">
            <h1 className="m-0 text-lg font-extrabold">Plan unavailable</h1>
            <p className="m-0 text-sm text-muted-foreground">{persistenceError || "This saved plan could not be opened."}</p>
          </div>
        </div>
      </div>
    );
  }

  if (planId && !remotePlan && (persistenceStatus === "loading" || persistenceStatus === "password-required")) {
    return (
      <div className="grid min-h-screen min-w-80 place-items-center bg-canvas p-4 font-sans text-foreground antialiased">
        <form
          className="grid w-full max-w-sm gap-3 rounded-lg border border-border bg-background p-5 shadow-xl"
          onSubmit={(event) => {
            event.preventDefault();
            loadPersistedPlan(planPassword);
          }}
        >
          <div className="grid gap-1">
            <h1 className="m-0 text-lg font-extrabold">Protected plan</h1>
            <p className="m-0 text-sm text-muted-foreground">Enter the password to open this seating plan.</p>
          </div>
          <Input
            autoFocus
            placeholder="Password"
            type="password"
            value={planPassword}
            onChange={(event) => setPlanPassword(event.target.value)}
          />
          {persistenceError ? <p className="m-0 text-sm font-bold text-destructive">{persistenceError}</p> : null}
          <Button type="submit" disabled={!planPassword.trim() || persistenceStatus === "loading"}>
            <Lock aria-hidden="true" className="size-4" />
            {persistenceStatus === "loading" ? "Loading" : "Unlock"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-80 bg-canvas font-sans text-foreground antialiased">
      <SidebarProvider className="bg-canvas" style={{ "--sidebar-width": "24rem" } as CSSProperties}>
        <Sidebar className="border-border" collapsible="offcanvas">
          <SidebarHeader className="border-b border-border bg-background p-2">
            <div className="flex min-h-10 items-center justify-between gap-2 px-2">
              <div className="min-w-0">
                <h2 className="m-0 overflow-hidden text-sm leading-tight font-semibold text-ellipsis whitespace-nowrap">{planName}</h2>
                <span className="text-xs font-semibold text-muted-foreground">{t.counts.seats(seats.length)}</span>
              </div>
              <SidebarTrigger className="flex-none" />
            </div>
          </SidebarHeader>
          <SidebarContent className="gap-0 bg-background">
            <SidebarSection
              isOpen={openSidebarSectionIds.has("tables")}
              meta={String(state.tables.length)}
              onToggle={() => toggleSidebarSection("tables")}
              title={t.sections.tables}
            >
              <div className="grid gap-2.5">
                {state.tables.map((table) => (
                  <TableEditor
                    key={table.id}
                    isDragging={draggedTableId === table.id}
                    isDropTarget={tableDropTargetId === table.id}
                    isOpen={openTableEditorIds.has(table.id)}
                    onChange={(patch) => updateTable(table.id, patch)}
                    onDragEnd={clearTableDragState}
                    onDragOver={(event) => handleTableDragOver(event, table.id)}
                    onDragStart={() => setDraggedTableId(table.id)}
                    onDrop={(event) => handleTableDrop(event, table.id)}
                    onDuplicate={() => duplicateTable(table.id)}
                    onKeyboardMove={(direction) => moveTable(table.id, direction)}
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
            </SidebarSection>

            <SidebarSection
              contentClassName="min-h-44"
              isOpen={openSidebarSectionIds.has("unseated")}
              meta={String(unseatedGuests.length)}
              onToggle={() => toggleSidebarSection("unseated")}
              title={t.sections.unseated}
            >
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
            </SidebarSection>

            <SidebarSection
              isOpen={openSidebarSectionIds.has("guests")}
              meta={t.counts.seatedGuests(state.guests.length - unseatedGuests.length, state.guests.length)}
              onToggle={() => toggleSidebarSection("guests")}
              title={t.actions.addGuest}
            >
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
            </SidebarSection>

            <SidebarSection
              isOpen={openSidebarSectionIds.has("import")}
              meta="CSV"
              onToggle={() => toggleSidebarSection("import")}
              title={t.actions.importGuests}
            >
              <div className="grid gap-2.5">
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
            </SidebarSection>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="max-h-screen overflow-auto bg-canvas p-4 lg:p-5 max-lg:max-h-none md:peer-data-[collapsible=offcanvas]:ml-0">
          <div className="mb-5 grid items-start gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto]">
            <div className="flex min-h-9 w-9 flex-none justify-start">
              <FloatingSidebarTrigger />
            </div>
            <div
              className="grid w-full max-w-3xl justify-self-center grid-cols-4 items-stretch overflow-hidden rounded-lg border border-border bg-background/80 max-md:max-w-none max-sm:grid-cols-2"
              aria-label={t.aria.planStatus}
            >
              <Stat label={t.stats.tables} value={state.tables.length} />
              <Stat label={t.stats.seats} value={seats.length} />
              <Stat label={t.stats.guests} value={state.guests.length} />
              <Stat label={t.stats.open} value={Math.max(0, seats.length - Object.keys(state.assignments).length)} />
            </div>
            <div className="flex min-w-max flex-none justify-end gap-3">
              <LanguageControl
                currentLabel={t.language.current}
                label={t.aria.language}
                nextLabel={t.language.next}
                onToggle={() => setLocale(locale === "it" ? "en" : "it")}
              />
              <Button type="button" variant="outline" onClick={exportSeatConfiguration}>
                <Download aria-hidden="true" className="size-4" />
                <span className="max-sm:sr-only">{t.actions.exportSeats}</span>
              </Button>
              <Button
                className="relative"
                disabled={isBusy || (remotePlan ? !isDirty && persistenceStatus === "saved" : false)}
                type="button"
                variant={isDirty ? "default" : "outline"}
                onClick={handleSaveButtonClick}
              >
                <Save aria-hidden="true" className="size-4" />
                <span className="max-sm:sr-only">
                  {remotePlan ? (isDirty ? "Save changes" : "Saved") : "Save online"}
                </span>
                {isDirty ? <span aria-label="Unsaved changes" className="absolute -top-1 -right-1 text-base leading-none font-black text-destructive">*</span> : null}
              </Button>
              <ShareControl
                copied={shareCopied}
                createPassword={createPassword}
                conflictPlan={conflictPlan}
                currentPlanId={currentPlanId}
                error={persistenceError}
                isDirty={isDirty}
                isOpen={shareOpen}
                linkSlug={linkSlug}
                normalizedLinkSlug={normalizedLinkSlug}
                clearPassword={clearPlanPassword}
                onCreatePlan={createPersistedPlan}
                onCopy={copyShareLink}
                onClearPasswordChange={(checked) => {
                  setClearPlanPassword(checked);
                  if (checked) setNextPlanPassword("");
                }}
                onLinkSlugChange={(value) => {
                  setLinkSlugEdited(true);
                  setLinkSlug(createEditablePlanSlug(value));
                }}
                onLoadConflictPlan={loadConflictPlan}
                onNextPasswordChange={(password) => {
                  setNextPlanPassword(password);
                  if (password.trim()) setClearPlanPassword(false);
                }}
                onPasswordChange={setPlanPassword}
                onCreatePasswordChange={setCreatePassword}
                onPlanNameChange={setPlanName}
                onSavePlan={savePersistedPlan}
                onToggle={toggleSharePanel}
                nextPassword={nextPlanPassword}
                password={planPassword}
                planName={planName}
                protectedPlan={remotePlan?.protected ?? false}
                status={persistenceStatus}
                t={t}
                url={shareUrl || createShareUrl(state, currentPlanId)}
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
  clearPassword,
  copied,
  createPassword,
  conflictPlan,
  currentPlanId,
  error,
  isDirty,
  isOpen,
  linkSlug,
  normalizedLinkSlug,
  nextPassword,
  onClearPasswordChange,
  onCreatePasswordChange,
  onCreatePlan,
  onCopy,
  onLinkSlugChange,
  onLoadConflictPlan,
  onNextPasswordChange,
  onPasswordChange,
  onPlanNameChange,
  onSavePlan,
  onToggle,
  password,
  planName,
  protectedPlan,
  status,
  t,
  url,
}: {
  clearPassword: boolean;
  copied: boolean;
  createPassword: string;
  conflictPlan: PersistedPlan | null;
  currentPlanId: string | undefined;
  error: string;
  isDirty: boolean;
  isOpen: boolean;
  linkSlug: string;
  normalizedLinkSlug: string;
  nextPassword: string;
  onClearPasswordChange: (checked: boolean) => void;
  onCreatePasswordChange: (password: string) => void;
  onCreatePlan: () => void;
  onCopy: (input: HTMLInputElement | null) => void;
  onLinkSlugChange: (slug: string) => void;
  onLoadConflictPlan: () => void;
  onNextPasswordChange: (password: string) => void;
  onPasswordChange: (password: string) => void;
  onPlanNameChange: (name: string) => void;
  onSavePlan: () => void;
  onToggle: () => void;
  password: string;
  planName: string;
  protectedPlan: boolean;
  status: PersistenceStatus;
  t: Messages;
  url: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isBusy = status === "loading" || status === "saving";
  const statusLabel = getPersistenceStatusLabel(status, Boolean(currentPlanId), isDirty);

  return (
    <div className="relative flex min-w-0 justify-end">
      <Button aria-expanded={isOpen} aria-label={t.aria.sharePlan} className="relative" size="icon" type="button" variant="outline" onClick={onToggle}>
        <Share2 aria-hidden="true" className="size-3.5" />
        {isDirty ? <span aria-label="Unsaved changes" className="absolute -top-1 -right-1 text-base leading-none font-black text-destructive">*</span> : null}
      </Button>
      {isOpen ? (
        <div className="absolute top-11 right-0 z-30 grid w-[min(24rem,calc(100vw-2rem))] gap-3 rounded-lg border border-border bg-background p-3 shadow-xl md:top-[4.5rem]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-black text-muted-foreground">{statusLabel}</span>
            {currentPlanId ? <span className="rounded-sm bg-accent px-2 py-1 text-xs font-black">/{currentPlanId}</span> : null}
          </div>
          {currentPlanId ? (
            <div className="grid gap-2">
              <Label className="grid gap-1.5">
                <span className="text-xs font-bold text-foreground/80">Plan name</span>
                <Input value={planName} onChange={(event) => onPlanNameChange(event.target.value)} />
              </Label>
              <Input aria-label={t.aria.shareLink} readOnly ref={inputRef} value={url} onFocus={(event) => event.currentTarget.select()} />
              {protectedPlan ? (
                <Label className="grid gap-1.5">
                  <span className="text-xs font-bold text-foreground/80">Current password</span>
                  <Input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} />
                </Label>
              ) : null}
              <Label className="grid gap-1.5">
                <span className="text-xs font-bold text-foreground/80">
                  {protectedPlan ? "New password" : "Add password"}
                </span>
                <Input
                  disabled={clearPassword}
                  placeholder={protectedPlan ? "Leave blank to keep current password" : "Optional password"}
                  type="password"
                  value={nextPassword}
                  onChange={(event) => onNextPasswordChange(event.target.value)}
                />
              </Label>
              {protectedPlan ? (
                <label className="flex items-center gap-2 rounded-md border border-border bg-accent px-2.5 py-2 text-sm font-semibold">
                  <input
                    checked={clearPassword}
                    className="size-4 accent-primary"
                    type="checkbox"
                    onChange={(event) => onClearPasswordChange(event.target.checked)}
                  />
                  Remove password protection
                </label>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => onCopy(inputRef.current)}>
                  {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                  {copied ? t.actions.copied : t.actions.copyLink}
                </Button>
                <Button type="button" onClick={onSavePlan} disabled={!isDirty || isBusy || (protectedPlan && !password.trim())}>
                  <Save aria-hidden="true" className="size-4" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label className="grid gap-1.5">
                <span className="text-xs font-bold text-foreground/80">Plan name</span>
                <Input value={planName} onChange={(event) => onPlanNameChange(event.target.value)} />
              </Label>
              <Label className="grid gap-1.5">
                <span className="text-xs font-bold text-foreground/80">Link name</span>
                <div className="flex overflow-hidden rounded-md border border-input bg-background">
                  <span className="flex min-w-8 items-center justify-center border-r border-input bg-accent px-2 text-sm font-bold text-muted-foreground">/</span>
                  <Input
                    aria-label="Link name"
                    className="border-0 shadow-none focus-visible:ring-0"
                    placeholder="nicos-wedding"
                    value={linkSlug}
                    onChange={(event) => onLinkSlugChange(event.target.value)}
                  />
                </div>
              </Label>
              <Input
                placeholder="Optional password"
                type="password"
                value={createPassword}
                onChange={(event) => onCreatePasswordChange(event.target.value)}
              />
              <Button type="button" onClick={onCreatePlan} disabled={isBusy || !normalizedLinkSlug}>
                <Save aria-hidden="true" className="size-4" />
                Save online
              </Button>
            </div>
          )}
          {status === "conflict" && conflictPlan ? (
            <div className="grid gap-2 rounded-md border border-destructive/30 bg-destructive-muted p-2">
              <div className="flex items-center gap-2 text-sm font-bold text-destructive">
                <AlertTriangle aria-hidden="true" className="size-4" />
                Stored version changed
              </div>
              <Button type="button" variant="outline" onClick={onLoadConflictPlan}>
                Load stored version
              </Button>
            </div>
          ) : null}
          {error ? <p className="m-0 text-sm font-bold text-destructive">{error}</p> : null}
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

function createShareUrl(state: PlannerState, planId?: string) {
  if (typeof window === "undefined") return "";

  const url = new URL(window.location.href);
  if (planId) {
    url.pathname = `/${planId}`;
    url.searchParams.delete(STATE_QUERY_KEY);
    url.searchParams.delete(LEGACY_STATE_QUERY_KEY);
    return url.href;
  }

  url.searchParams.set(STATE_QUERY_KEY, encodeState(state));
  url.searchParams.delete(LEGACY_STATE_QUERY_KEY);
  return url.href;
}

function replaceUrlWithPlanId(planId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/${planId}`;
  url.searchParams.delete(STATE_QUERY_KEY);
  url.searchParams.delete(LEGACY_STATE_QUERY_KEY);
  window.history.replaceState(null, "", url);
}

function resolvePersistenceError(code: string | undefined, fallback: string) {
  switch (code) {
    case "INVALID_PASSWORD":
      return "The password is incorrect.";
    case "PASSWORD_REQUIRED":
      return "This plan requires a password.";
    case "PLAN_NOT_FOUND":
      return "This saved plan was not found.";
    case "PLAN_STORE_NOT_CONFIGURED":
      return "Saved plans are not configured on this deployment.";
    case "INVALID_PLAN_ID":
      return "Choose a link name with at least 3 letters or numbers.";
    case "PLAN_ID_TAKEN":
      return "That link name is already taken.";
    case "REV_CONFLICT":
      return "The stored plan changed since you loaded it.";
    default:
      return fallback;
  }
}

function getApiError(payload: unknown) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : undefined;
}

function isPersistedPlan(payload: unknown): payload is PersistedPlan {
  if (typeof payload !== "object" || payload === null) return false;
  const value = payload as Record<string, unknown>;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.protected === "boolean" &&
    Number.isInteger(value.rev) &&
    typeof value.state === "object" &&
    value.state !== null
  );
}

function readPlannerDraft(planId: string | undefined, baseRev: number | null): PlannerDraft | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(createPlannerDraftKey(planId));
    return raw ? parsePlannerDraft(JSON.parse(raw) as unknown, planId ?? null, baseRev) : null;
  } catch {
    return null;
  }
}

function writePlannerDraft(planId: string | null, draft: Pick<PlannerDraft, "baseRev" | "name" | "state">) {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    const nextDraft: PlannerDraft = {
      baseRev: draft.baseRev,
      name: draft.name,
      planId,
      state: draft.state,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    storage.setItem(createPlannerDraftKey(planId ?? undefined), JSON.stringify(nextDraft));
  } catch {
    // Local drafts are best-effort; quota and browser privacy failures should not break editing.
  }
}

function clearPlannerDraft(planId: string | null) {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.removeItem(createPlannerDraftKey(planId ?? undefined));
  } catch {
    // Ignore localStorage failures.
  }
}

function parsePlannerDraft(value: unknown, expectedPlanId: string | null, expectedBaseRev: number | null): PlannerDraft | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const planId = typeof value.planId === "string" ? value.planId : value.planId === null ? null : undefined;
  if (planId === undefined || planId !== expectedPlanId) return null;
  const baseRev = typeof value.baseRev === "number" && Number.isInteger(value.baseRev) ? value.baseRev : value.baseRev === null ? null : undefined;
  if (baseRev === undefined) return null;
  if (expectedPlanId && expectedBaseRev !== null && baseRev !== expectedBaseRev) return null;
  if (typeof value.name !== "string" || typeof value.updatedAt !== "string") return null;

  const state = parseDraftPlannerState(value.state);
  if (!state) return null;

  return {
    baseRev,
    name: value.name,
    planId,
    state,
    updatedAt: value.updatedAt,
    version: 1,
  };
}

function parseDraftPlannerState(value: unknown): PlannerState | null {
  if (!isRecord(value) || !Array.isArray(value.tables) || !Array.isArray(value.guests) || !isStringRecord(value.assignments)) return null;
  if (!value.tables.every(isDraftTable) || !value.guests.every(isDraftGuest)) return null;
  return sanitizeAssignments({
    assignments: value.assignments,
    guests: value.guests,
    tables: value.tables,
  });
}

function isDraftTable(value: unknown): value is WeddingTable {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.shape === "round" || value.shape === "rectangular") &&
    isNonNegativeInteger(value.roundSeats) &&
    isNonNegativeInteger(value.topSeats) &&
    isNonNegativeInteger(value.rightSeats) &&
    isNonNegativeInteger(value.bottomSeats) &&
    isNonNegativeInteger(value.leftSeats)
  );
}

function isDraftGuest(value: unknown): value is Guest {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.group === "string" && typeof value.dietary === "string";
}

function isNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function hasUrlStateQuery() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has(STATE_QUERY_KEY) || params.has(LEGACY_STATE_QUERY_KEY);
}

function createPlannerDraftKey(planId: string | undefined) {
  return `wedding-table-setting:draft:${planId ?? "local"}`;
}

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function createSavedSnapshot(state: PlannerState, name: string) {
  return JSON.stringify({ name: name.trim(), state: encodeState(state) });
}

function getDefaultPlanName() {
  return "Wedding seating plan";
}

function createEditablePlanSlug(value: string) {
  return value
    .trimStart()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}

function createPlanSlug(value: string) {
  return createEditablePlanSlug(value).replace(/^-+|-+$/g, "");
}

function createCsvFilename(value: string) {
  return (
    createEditablePlanSlug(value)
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "wedding-seating-plan"
  );
}

function getPersistenceStatusLabel(status: PersistenceStatus, hasPlanId: boolean, isDirty: boolean) {
  if (!hasPlanId) return "Local link";
  if (status === "loading") return "Loading";
  if (status === "saving") return "Saving";
  if (status === "conflict") return "Conflict";
  if (status === "error") return "Needs attention";
  if (isDirty) return "Unsaved changes";
  return "Saved online";
}

function resolveInitialPersistenceStatus(planId: string | undefined, initialPlanLoad: InitialPlanLoad | undefined): PersistenceStatus {
  if (!planId) return "idle";
  if (!initialPlanLoad) return "loading";
  if (initialPlanLoad.status === "available") return "saved";
  if (initialPlanLoad.status === "password-required") return "password-required";
  return "error";
}

function resolveInitialPersistenceError(initialPlanLoad: InitialPlanLoad | undefined) {
  if (initialPlanLoad?.status === "not-found") return "This saved plan was not found.";
  if (initialPlanLoad?.status === "store-not-configured") return "Saved plans are not configured on this deployment.";
  return "";
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
