import type { CSSProperties } from "react";

import { dietaryBadgeDefinitions, STATE_QUERY_KEY } from "@/planner/constants";
import type {
  DietaryBadgeDefinition,
  Guest,
  LegacyPlannerState,
  PlannerState,
  Seat,
  SeatSide,
  WeddingTable,
} from "@/planner/types";

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
    roundSeats: 8,
    topSeats: 0,
    rightSeats: 6,
    bottomSeats: 0,
    leftSeats: 6,
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
    .map(([, groupGuests]) => groupGuests.sort((a, b) => a.name.localeCompare(b.name)));
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
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeState(encoded: string): PlannerState | null {
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
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(STATE_QUERY_KEY);
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
