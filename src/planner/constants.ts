import type { DietaryBadgeDefinition, PlannerState } from "@/planner/types";

export const LEGACY_STATE_QUERY_KEY = "state";
export const STATE_QUERY_KEY = "s";

export const dietaryBadgeDefinitions: DietaryBadgeDefinition[] = [
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

export function createStarterState(labels: { table: string; topTable: string }): PlannerState {
  return {
    tables: [
      {
        id: "table-1",
        name: labels.topTable,
        shape: "rectangular",
        roundSeats: 8,
        topSeats: 0,
        rightSeats: 6,
        bottomSeats: 0,
        leftSeats: 6,
      },
      {
        id: "table-2",
        name: `${labels.table} 2`,
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
}

export const starterState: PlannerState = createStarterState({ table: "Table", topTable: "Top Table" });
