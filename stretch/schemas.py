import csv
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Slot = Literal["breakfast", "lunch", "dinner"]
Equipment = Literal["stovetop", "microwave", "oven"]
Diet = Literal["vegetarian", "vegan", "halal", "kosher"]
PantryLevel = Literal["full", "half", "low"]


class Ingredient(BaseModel):
    id: str
    name: str
    kroger_product: str
    package_g: int
    price_cents: int
    ebt_eligible: bool
    kcal_100g: float
    protein_100g: float
    fiber_100g: float
    sodium_mg_100g: float
    sugar_100g: float
    perishable_days: int
    tags: list[str] = []
    aisle: str = "other"
    staple: bool = False
    price_source: Literal["csv", "api"] = "csv"
    in_stock: bool = True


class Store(BaseModel):
    location_id: str
    name: str
    address: str
    distance_miles: float


class Meal(BaseModel):
    id: str
    name: str
    slot: Slot
    servings: int
    prep_min: int
    equipment: list[Equipment]
    palatability: int = Field(ge=1, le=5)
    ingredients: dict[str, int]


class PantryItem(BaseModel):
    ingredient_id: str
    level: PantryLevel
    source: Literal["photo", "text", "manual", "staple"]


class Household(BaseModel):
    people: int
    trip_days: int = 7
    deposit_date: date | None = None
    school_breakfasts: int = 0
    school_lunches: int = 0
    ebt_cents: int
    cash_cents: int
    snap_only: bool = False
    max_prep_min: int = 30
    equipment: list[Equipment] = ["stovetop", "microwave"]
    diet: list[Diet] = []
    excluded_ingredients: list[str] = []
    excluded_meals: list[str] = []
    accepted_meals: list[str] | None = None
    out_of_stock: list[str] = []
    pantry: dict[str, int] = {}
    assume_staples: bool = True


class NutrientTargets(BaseModel):
    kcal_min: int
    protein_g_min: int
    fiber_g_min: int
    sodium_mg_max: int
    sugar_g_max: int


class PlanItem(BaseModel):
    ingredient_id: str
    packages: int
    line_cents: int
    ebt_eligible: bool
    aisle: str


class Plan(BaseModel):
    meals: dict[str, int]
    cart: list[PlanItem]
    ebt_cents: int
    cash_cents: int
    basket_cents: int
    cash_remaining_cents: int
    eligible_pct: int
    trips_covered: float
    covers_until: date
    from_pantry: dict[str, int]
    nutrition: dict[str, float]
    targets: NutrientTargets
    shortfalls: dict[str, float]
    what_changed: str | None
    solve_ms: int


def _to_bool(value: str, field: str, row_no: int) -> bool:
    v = (value or "").strip().lower()
    if v in ("true", "1", "yes", "y"):
        return True
    if v in ("false", "0", "no", "n", ""):
        return False
    raise ValueError(f"ingredients.csv row {row_no}: {field} is not a boolean: {value!r}")


def load_ingredients(path: str = "data/ingredients.csv") -> dict[str, Ingredient]:
    """Read the ingredient CSV into id -> Ingredient, failing loudly on any bad row."""
    out: dict[str, Ingredient] = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for row_no, row in enumerate(reader, start=2):
            if not (row.get("id") or "").strip():
                continue
            try:
                ing = Ingredient(
                    id=row["id"].strip(),
                    name=row["name"].strip(),
                    kroger_product=row["kroger_product"].strip(),
                    package_g=int(row["package_g"]),
                    price_cents=int(row["price_cents"]),
                    ebt_eligible=_to_bool(row["ebt_eligible"], "ebt_eligible", row_no),
                    kcal_100g=float(row["kcal_100g"]),
                    protein_100g=float(row["protein_100g"]),
                    fiber_100g=float(row["fiber_100g"]),
                    sodium_mg_100g=float(row["sodium_mg_100g"]),
                    sugar_100g=float(row["sugar_100g"]),
                    perishable_days=int(row["perishable_days"]),
                    tags=[t for t in (row.get("tags") or "").split("|") if t.strip()],
                    aisle=(row.get("aisle") or "other").strip() or "other",
                    staple=_to_bool(row.get("staple", ""), "staple", row_no),
                )
            except (KeyError, TypeError, ValueError) as exc:
                raise ValueError(f"ingredients.csv row {row_no} is invalid: {exc}") from exc
            if ing.id in out:
                raise ValueError(f"ingredients.csv row {row_no}: duplicate id {ing.id!r}")
            out[ing.id] = ing
    if not out:
        raise ValueError(f"{path} contained no ingredient rows")
    return out
