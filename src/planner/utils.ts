import type { CSSProperties } from "react";

import { dietaryBadgeDefinitions, LEGACY_STATE_QUERY_KEY, STATE_QUERY_KEY } from "@/planner/constants";
import { orderGuestsForAlternatingSeating } from "@/planner/name-gender";
import type {
  DietaryBadgeDefinition,
  Guest,
  LegacyPlannerState,
  PlannerState,
  Seat,
  SeatSide,
  WeddingTable,
} from "@/planner/types";

type CompactTableV2 = [
  id: string,
  name: string,
  shape: CompactTableShape,
  roundSeats: number,
  topSeats: number,
  rightSeats: number,
  bottomSeats: number,
  leftSeats: number,
];

type CompactGuestV2 = [id: string, name: string, group: string, dietary: string];
type CompactAssignmentV2 = [tableIndex: number, side: CompactSeatSideV2, seatIndex: number, guestIndex: number];
type CompactPlannerStateV2 = [version: 2, tables: CompactTableV2[], guests: CompactGuestV2[], assignments: CompactAssignmentV2[]];

type CompactTableV3 =
  | [name: string]
  | [name: string, roundSeats: number]
  | [name: string, topSeats: number, rightSeats: number, bottomSeats: number, leftSeats: number];
type CompactGuestV3 = [name: string] | [name: string, group: string] | [name: string, group: string, dietary: string];
type CompactAssignmentV3 = [tableIndex: number, seatCode: number, guestIndex: number];
type CompactPlannerStateV3 = [version: 3, tables: CompactTableV3[], guests: CompactGuestV3[], assignments: CompactAssignmentV3[]];
type CompactTableShape = 0 | 1;
type CompactSeatSideV2 = "t" | "r" | "b" | "l" | "g";

const RECTANGULAR_TABLE_DEFAULTS = {
  roundSeats: 8,
  topSeats: 0,
  rightSeats: 6,
  bottomSeats: 0,
  leftSeats: 6,
} as const;
const ROUND_TABLE_DEFAULTS = {
  topSeats: 0,
  rightSeats: 6,
  bottomSeats: 0,
  leftSeats: 6,
} as const;
const SEAT_SIDE_CODE_MULTIPLIER = 32;

export type SeatLabels = {
  bottom: string;
  left: string;
  right: string;
  seat: string;
  top: string;
};

const defaultSeatLabels: SeatLabels = {
  bottom: "Bottom",
  left: "Left",
  right: "Right",
  seat: "Seat",
  top: "Top",
};

export function createDefaultTable(number: number, tableLabel = "Table"): WeddingTable {
  return {
    id: createId("table"),
    name: `${tableLabel} ${number}`,
    shape: "rectangular",
    ...RECTANGULAR_TABLE_DEFAULTS,
  };
}

export function createSeatsForTable(table: WeddingTable, labels: SeatLabels = defaultSeatLabels): Seat[] {
  if (table.shape === "round") {
    return Array.from({ length: table.roundSeats }, (_, index) => ({
      id: `${table.id}:ring:${index + 1}`,
      tableId: table.id,
      side: "ring" as const,
      index: index + 1,
      label: `${labels.seat} ${index + 1}`,
    }));
  }

  const seats: Seat[] = [];
  addSideSeats(seats, table, "top", table.topSeats, labels.top);
  addSideSeats(seats, table, "left", table.leftSeats, labels.left);
  addSideSeats(seats, table, "right", table.rightSeats, labels.right);
  addSideSeats(seats, table, "bottom", table.bottomSeats, labels.bottom);
  return seats;
}

export function getRoundSeatStyle(index: number, total: number): CSSProperties {
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

export function findSeatForGuest(assignments: Record<string, string>, guestId: string) {
  return Object.entries(assignments).find(([, assignedGuestId]) => assignedGuestId === guestId)?.[0];
}

export function sanitizeAssignments(state: PlannerState): PlannerState {
  const validSeatIds = new Set(state.tables.flatMap((table) => createSeatsForTable(table)).map((seat) => seat.id));
  const validGuestIds = new Set(state.guests.map((guest) => guest.id));
  const assignments: Record<string, string> = {};
  for (const [seatId, guestId] of Object.entries(state.assignments)) {
    if (validSeatIds.has(seatId) && validGuestIds.has(guestId)) {
      assignments[seatId] = guestId;
    }
  }
  return { ...state, assignments };
}

export function groupGuests(guests: Guest[]) {
  const groups = new Map<string, Guest[]>();
  for (const guest of guests) {
    const group = guest.group.trim() || "Ungrouped";
    groups.set(group, [...(groups.get(group) ?? []), guest]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([, groupGuests]) => orderGuestsForAlternatingSeating(groupGuests));
}

export function getDietaryBadges(dietary: string) {
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

export function parseGuestsCsv(text: string): Omit<Guest, "id">[] {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length === 0) return [];

  const firstRow = rows[0].map((cell) => cell.trim().toLowerCase());
  const hasHeaders = findHeaderIndex(firstRow, ["name", "nome"]) >= 0;
  const headers = hasHeaders ? firstRow : ["name", "group", "dietary"];
  const dataRows = hasHeaders ? rows.slice(1) : rows;
  const nameIndex = Math.max(0, findHeaderIndex(headers, ["name", "nome"]));
  const groupIndex = findHeaderIndex(headers, ["group", "gruppo"]);
  const dietaryIndex = findHeaderIndex(headers, ["dietary", "diet", "dieta", "alimentazione", "restrizioni alimentari"]);
  const notesIndex = findHeaderIndex(headers, ["notes", "note"]);

  return dataRows
    .map((row) => ({
      name: row[nameIndex]?.trim() ?? "",
      group: groupIndex >= 0 ? row[groupIndex]?.trim() ?? "" : "",
      dietary: dietaryIndex >= 0 ? row[dietaryIndex]?.trim() ?? "" : notesIndex >= 0 ? row[notesIndex]?.trim() ?? "" : "",
    }))
    .filter((guest) => guest.name);
}

function findHeaderIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

export function encodeState(state: PlannerState) {
  return encodeJson(compactPlannerState(state));
}

export function decodeState(encoded: string): PlannerState | null {
  try {
    const parsed = decodeJson(encoded) as CompactPlannerStateV3 | CompactPlannerStateV2 | LegacyPlannerState;
    if (isCompactPlannerStateV3(parsed)) return expandCompactPlannerStateV3(parsed);
    if (isCompactPlannerStateV2(parsed)) return expandCompactPlannerStateV2(parsed);
    if (!Array.isArray(parsed.tables) || !Array.isArray(parsed.guests) || typeof parsed.assignments !== "object") return null;
    return sanitizeAssignments(normalizePlannerState(parsed));
  } catch {
    return null;
  }
}

export function normalizePlannerState(state: LegacyPlannerState): PlannerState {
  return {
    ...state,
    guests: state.guests.map(({ notes, ...guest }) => ({
      ...guest,
      dietary: guest.dietary ?? notes ?? "",
    })),
  };
}

export function loadStateFromUrl() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(STATE_QUERY_KEY) ?? params.get(LEGACY_STATE_QUERY_KEY);
  return encoded ? decodeState(encoded) : null;
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function escapeCsvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function compactPlannerState(state: PlannerState): CompactPlannerStateV3 {
  const tableIndexById = new Map(state.tables.map((table, index) => [table.id, index]));
  const guestIndexById = new Map(state.guests.map((guest, index) => [guest.id, index]));
  const tables = state.tables.map(compactTableV3);
  const guests = state.guests.map(compactGuestV3);
  const assignments: CompactAssignmentV3[] = [];

  for (const [seatId, guestId] of Object.entries(state.assignments)) {
    const seat = parseSeatId(seatId);
    const tableIndex = seat ? tableIndexById.get(seat.tableId) : undefined;
    const guestIndex = guestIndexById.get(guestId);
    const seatCode = seat ? compactSeatCode(seat.side, seat.index) : null;
    if (tableIndex === undefined || guestIndex === undefined || seatCode === null) continue;
    assignments.push([tableIndex, seatCode, guestIndex]);
  }

  return [3, tables, guests, assignments];
}

function compactTableV3(table: WeddingTable): CompactTableV3 {
  if (table.shape === "round") return [table.name, -table.roundSeats];
  if (
    table.roundSeats === RECTANGULAR_TABLE_DEFAULTS.roundSeats &&
    table.topSeats === RECTANGULAR_TABLE_DEFAULTS.topSeats &&
    table.rightSeats === RECTANGULAR_TABLE_DEFAULTS.rightSeats &&
    table.bottomSeats === RECTANGULAR_TABLE_DEFAULTS.bottomSeats &&
    table.leftSeats === RECTANGULAR_TABLE_DEFAULTS.leftSeats
  ) {
    return [table.name];
  }
  return [table.name, table.topSeats, table.rightSeats, table.bottomSeats, table.leftSeats];
}

function compactGuestV3(guest: Guest): CompactGuestV3 {
  if (guest.dietary) return [guest.name, guest.group, guest.dietary];
  if (guest.group) return [guest.name, guest.group];
  return [guest.name];
}

function expandCompactPlannerStateV3(compact: CompactPlannerStateV3): PlannerState | null {
  const tables = compact[1].map(expandCompactTableV3);
  const guests = compact[2].map(expandCompactGuestV3);
  const assignments: Record<string, string> = {};

  for (const [tableIndex, seatCode, guestIndex] of compact[3]) {
    const table = tables[tableIndex];
    const guest = guests[guestIndex];
    const seat = expandSeatCode(seatCode);
    if (!table || !guest || !seat) continue;
    assignments[`${table.id}:${seat.side}:${seat.index}`] = guest.id;
  }

  return sanitizeAssignments({ tables, guests, assignments });
}

function expandCompactTableV3(table: CompactTableV3, index: number): WeddingTable {
  if (table.length === 2) {
    return {
      id: createSequentialId("table", index),
      name: table[0],
      shape: "round",
      roundSeats: Math.abs(table[1]),
      ...ROUND_TABLE_DEFAULTS,
    };
  }

  if (table.length === 5) {
    return {
      id: createSequentialId("table", index),
      name: table[0],
      shape: "rectangular",
      roundSeats: RECTANGULAR_TABLE_DEFAULTS.roundSeats,
      topSeats: table[1],
      rightSeats: table[2],
      bottomSeats: table[3],
      leftSeats: table[4],
    };
  }

  return {
    id: createSequentialId("table", index),
    name: table[0],
    shape: "rectangular",
    ...RECTANGULAR_TABLE_DEFAULTS,
  };
}

function expandCompactGuestV3(guest: CompactGuestV3, index: number): Guest {
  return {
    id: createSequentialId("guest", index),
    name: guest[0],
    group: guest[1] ?? "",
    dietary: guest[2] ?? "",
  };
}

function expandCompactPlannerStateV2(compact: CompactPlannerStateV2): PlannerState | null {
  const tables = compact[1].map(expandCompactTableV2);
  const guests = compact[2].map(expandCompactGuestV2);
  const assignments: Record<string, string> = {};

  for (const [tableIndex, sideCode, seatIndex, guestIndex] of compact[3]) {
    const table = tables[tableIndex];
    const guest = guests[guestIndex];
    const side = expandSeatSideV2(sideCode);
    if (!table || !guest || !side || !Number.isInteger(seatIndex) || seatIndex < 1) continue;
    assignments[`${table.id}:${side}:${seatIndex}`] = guest.id;
  }

  return sanitizeAssignments({ tables, guests, assignments });
}

function expandCompactTableV2(table: CompactTableV2): WeddingTable {
  return {
    id: expandId(table[0], "table"),
    name: table[1],
    shape: table[2] === 1 ? "round" : "rectangular",
    roundSeats: table[3],
    topSeats: table[4],
    rightSeats: table[5],
    bottomSeats: table[6],
    leftSeats: table[7],
  };
}

function expandCompactGuestV2(guest: CompactGuestV2): Guest {
  return {
    id: expandId(guest[0], "guest"),
    name: guest[1],
    group: guest[2],
    dietary: guest[3],
  };
}

function isCompactPlannerStateV3(value: unknown): value is CompactPlannerStateV3 {
  if (!Array.isArray(value) || value[0] !== 3 || !Array.isArray(value[1]) || !Array.isArray(value[2]) || !Array.isArray(value[3])) {
    return false;
  }

  return value[1].every(isCompactTableV3) && value[2].every(isCompactGuestV3) && value[3].every(isCompactAssignmentV3);
}

function isCompactPlannerStateV2(value: unknown): value is CompactPlannerStateV2 {
  if (!Array.isArray(value) || value[0] !== 2 || !Array.isArray(value[1]) || !Array.isArray(value[2]) || !Array.isArray(value[3])) {
    return false;
  }

  return value[1].every(isCompactTableV2) && value[2].every(isCompactGuestV2) && value[3].every(isCompactAssignmentV2);
}

function isCompactTableV3(value: unknown): value is CompactTableV3 {
  if (!Array.isArray(value) || typeof value[0] !== "string") return false;
  if (value.length === 1) return true;
  if (value.length === 2) return Number.isInteger(value[1]) && value[1] < 0;
  return value.length === 5 && value.slice(1).every((item) => Number.isInteger(item) && item >= 0);
}

function isCompactGuestV3(value: unknown): value is CompactGuestV3 {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 3 &&
    typeof value[0] === "string" &&
    (value[1] === undefined || typeof value[1] === "string") &&
    (value[2] === undefined || typeof value[2] === "string")
  );
}

function isCompactAssignmentV3(value: unknown): value is CompactAssignmentV3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    value[1] >= 1 &&
    Number.isInteger(value[2])
  );
}

function isCompactTableV2(value: unknown): value is CompactTableV2 {
  return (
    Array.isArray(value) &&
    value.length === 8 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string" &&
    (value[2] === 0 || value[2] === 1) &&
    value.slice(3).every((item) => Number.isInteger(item) && item >= 0)
  );
}

function isCompactGuestV2(value: unknown): value is CompactGuestV2 {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string" &&
    typeof value[2] === "string" &&
    typeof value[3] === "string"
  );
}

function isCompactAssignmentV2(value: unknown): value is CompactAssignmentV2 {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    Number.isInteger(value[0]) &&
    isCompactSeatSideV2(value[1]) &&
    Number.isInteger(value[2]) &&
    value[2] >= 1 &&
    Number.isInteger(value[3])
  );
}

function createSequentialId(prefix: "guest" | "table", index: number) {
  return `${prefix}-${index + 1}`;
}

function compactId(id: string, prefix: "guest" | "table") {
  const fullPrefix = `${prefix}-`;
  return id.startsWith(fullPrefix) ? id.slice(fullPrefix.length) : `!${id}`;
}

function expandId(id: string, prefix: "guest" | "table") {
  const fullPrefix = `${prefix}-`;
  if (id.startsWith("!")) return id.slice(1);
  return id.startsWith(fullPrefix) ? id : `${fullPrefix}${id}`;
}

function parseSeatId(seatId: string): { tableId: string; side: SeatSide; index: number } | null {
  const parts = seatId.split(":");
  if (parts.length !== 3) return null;
  const side = parts[1];
  const index = Number(parts[2]);
  if (!isSeatSide(side) || !Number.isInteger(index) || index < 1) return null;
  return { tableId: parts[0], side, index };
}

function compactSeatCode(side: SeatSide, index: number) {
  const sideIndex = seatSideIndex(side);
  if (sideIndex === null || !Number.isInteger(index) || index < 1 || index >= SEAT_SIDE_CODE_MULTIPLIER) return null;
  return sideIndex * SEAT_SIDE_CODE_MULTIPLIER + index;
}

function expandSeatCode(code: number): { side: SeatSide; index: number } | null {
  const sideIndex = Math.floor(code / SEAT_SIDE_CODE_MULTIPLIER);
  const index = code % SEAT_SIDE_CODE_MULTIPLIER;
  const side = seatSideFromIndex(sideIndex);
  if (!side || index < 1) return null;
  return { side, index };
}

function seatSideIndex(side: SeatSide) {
  switch (side) {
    case "top":
      return 0;
    case "right":
      return 1;
    case "bottom":
      return 2;
    case "left":
      return 3;
    case "ring":
      return 4;
    default:
      return null;
  }
}

function seatSideFromIndex(index: number): SeatSide | null {
  switch (index) {
    case 0:
      return "top";
    case 1:
      return "right";
    case 2:
      return "bottom";
    case 3:
      return "left";
    case 4:
      return "ring";
    default:
      return null;
  }
}

function compactSeatSideV2(side: SeatSide): CompactSeatSideV2 | null {
  switch (side) {
    case "top":
      return "t";
    case "right":
      return "r";
    case "bottom":
      return "b";
    case "left":
      return "l";
    case "ring":
      return "g";
    default:
      return null;
  }
}

function expandSeatSideV2(side: CompactSeatSideV2): SeatSide | null {
  switch (side) {
    case "t":
      return "top";
    case "r":
      return "right";
    case "b":
      return "bottom";
    case "l":
      return "left";
    case "g":
      return "ring";
    default:
      return null;
  }
}

function isSeatSide(value: string): value is SeatSide {
  return value === "top" || value === "right" || value === "bottom" || value === "left" || value === "ring";
}

function isCompactSeatSideV2(value: unknown): value is CompactSeatSideV2 {
  return value === "t" || value === "r" || value === "b" || value === "l" || value === "g";
}

function encodeJson(value: unknown) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeJson(encoded: string) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
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
