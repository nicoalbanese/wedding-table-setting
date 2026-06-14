export type TableShape = "round" | "rectangular";
export type SeatSide = "top" | "right" | "bottom" | "left" | "ring";

export type Guest = {
  id: string;
  name: string;
  group: string;
  dietary: string;
};

export type LegacyGuest = Omit<Guest, "dietary"> & {
  dietary?: string;
  notes?: string;
};

export type WeddingTable = {
  id: string;
  name: string;
  shape: TableShape;
  roundSeats: number;
  topSeats: number;
  rightSeats: number;
  bottomSeats: number;
  leftSeats: number;
};

export type Seat = {
  id: string;
  tableId: string;
  side: SeatSide;
  index: number;
  label: string;
};

export type PlannerState = {
  tables: WeddingTable[];
  guests: Guest[];
  assignments: Record<string, string>;
};

export type LegacyPlannerState = Omit<PlannerState, "guests"> & {
  guests: LegacyGuest[];
};

export type DietaryBadgeDefinition = {
  code: string;
  label: string;
  className: string;
  patterns: RegExp[];
};

export type SeatModalState = {
  seatId: string;
  query: string;
} | null;

export type GuestEditModalState = {
  guestId: string;
  name: string;
  group: string;
  dietary: string;
} | null;

export type NewGuestForm = {
  name: string;
  group: string;
  dietary: string;
};
