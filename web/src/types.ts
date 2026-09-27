// Mirrors of stretch/schemas.py. Field names are identical to the Pydantic models; never rename.

export type Slot = "breakfast" | "lunch" | "dinner";
export type Equipment = "stovetop" | "microwave" | "oven";
export type Diet = "vegetarian" | "vegan" | "halal" | "kosher";
export type PantryLevel = "full" | "half" | "low";
export type PantrySource = "photo" | "text" | "manual" | "staple";

export interface Ingredient {
  id: string;
  name: string;
  kroger_product: string;
  package_g: number;
  price_cents: number;
  ebt_eligible: boolean;
  kcal_100g: number;
  protein_100g: number;
  fiber_100g: number;
  sodium_mg_100g: number;
  sugar_100g: number;
  perishable_days: number;
  tags: string[];
  aisle: string;
  staple: boolean;
  price_source: "csv" | "api";
  in_stock: boolean;
}

export interface Meal {
  id: string;
  name: string;
  slot: Slot;
  servings: number;
  prep_min: number;
  equipment: Equipment[];
  palatability: number;
  ingredients: Record<string, number>;
}

export interface PantryItem {
  ingredient_id: string;
  level: PantryLevel;
  source: PantrySource;
}

export interface Household {
  people: number;
  trip_days: number;
  deposit_date: string | null; // ISO date "2026-10-14"
  school_breakfasts: number;
  school_lunches: number;
  ebt_cents: number;
  cash_cents: number;
  snap_only: boolean;
  max_prep_min: number;
  equipment: Equipment[];
  diet: Diet[];
  excluded_ingredients: string[];
  excluded_meals: string[];
  accepted_meals: string[] | null;
  out_of_stock: string[];
  pantry: Record<string, number>;
  assume_staples: boolean;
}

export interface NutrientTargets {
  kcal_min: number;
  protein_g_min: number;
  fiber_g_min: number;
  sodium_mg_max: number;
  sugar_g_max: number;
}

export interface PlanItem {
  ingredient_id: string;
  packages: number;
  line_cents: number;
  ebt_eligible: boolean;
  aisle: string;
}

export interface Plan {
  meals: Record<string, number>; // meal_id -> times cooked
  cart: PlanItem[];
  ebt_cents: number;
  cash_cents: number;
  basket_cents: number;
  cash_remaining_cents: number;
  eligible_pct: number;
  trips_covered: number;
  covers_until: string; // ISO date
  from_pantry: Record<string, number>;
  nutrition: Record<string, number>; // keys: kcal, protein, fiber, sodium, sugar
  targets: NutrientTargets;
  shortfalls: Record<string, number>;
  what_changed: string | null;
  solve_ms: number;
}

export interface AgentTurn {
  reply: string;
  plan: Plan | null;
  household: Household;
}

export const DEFAULT_HOUSEHOLD: Household = {
  people: 2,
  trip_days: 7,
  deposit_date: null,
  school_breakfasts: 0,
  school_lunches: 0,
  ebt_cents: 15000,
  cash_cents: 2000,
  snap_only: false,
  max_prep_min: 30,
  equipment: ["stovetop", "microwave"],
  diet: [],
  excluded_ingredients: [],
  excluded_meals: [],
  accepted_meals: null,
  out_of_stock: [],
  pantry: {},
  assume_staples: true,
};
