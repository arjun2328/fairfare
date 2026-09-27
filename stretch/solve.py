import math
import time
from datetime import date, timedelta

from ortools.sat.python import cp_model

from .schemas import Household, Ingredient, Meal, NutrientTargets, Plan, PlanItem

NUTRIENTS = ("kcal", "protein", "fiber", "sodium", "sugar")
_PER_100G = {
    "kcal": "kcal_100g",
    "protein": "protein_100g",
    "fiber": "fiber_100g",
    "sodium": "sodium_mg_100g",
    "sugar": "sugar_100g",
}


def _candidates(meals: list[Meal], ingredients: dict[str, Ingredient],
                household: Household) -> list[Meal]:
    excluded_ing = set(household.excluded_ingredients)
    excluded_meals = set(household.excluded_meals)
    equipment = set(household.equipment)
    accepted = set(household.accepted_meals) if household.accepted_meals is not None else None

    out = []
    for m in meals:
        if m.id in excluded_meals:
            continue
        if accepted is not None and m.id not in accepted:
            continue
        if m.prep_min > household.max_prep_min:
            continue
        if not set(m.equipment) <= equipment:
            continue
        if any(i not in ingredients for i in m.ingredients):
            continue
        if excluded_ing & set(m.ingredients):
            continue
        out.append(m)
    return out


def solve(meals: list[Meal],
          ingredients: dict[str, Ingredient],
          household: Household,
          targets: NutrientTargets,
          time_limit_s: float = 2.0) -> Plan | None:
    """Choose meals and packages under the EBT and cash budgets; all model math is integer."""
    started = time.perf_counter()
    D = household.trip_days
    cand = _candidates(meals, ingredients, household)
    if not cand:
        return None

    # ---- pre-computation (plain Python, integers only past this point) ----
    school_b = round(household.school_breakfasts * D / 7)
    school_l = round(household.school_lunches * D / 7)
    needed = {
        "breakfast": max(0, D * household.people - school_b),
        "lunch": max(0, D * household.people - school_l),
        "dinner": max(0, D * household.people),
    }

    coef: dict[str, dict[str, int]] = {n: {} for n in NUTRIENTS}
    for m in cand:
        for n in NUTRIENTS:
            attr = _PER_100G[n]
            coef[n][m.id] = round(sum(
                g * getattr(ingredients[i], attr) / 100 for i, g in m.ingredients.items()
            ))

    used_ids = sorted({i for m in cand for i in m.ingredients})
    pantry_g: dict[str, int] = {}
    for i in used_ids:
        g = household.pantry.get(i, 0)
        if household.assume_staples and ingredients[i].staple:
            g = max(g, ingredients[i].package_g)
        pantry_g[i] = g

    max_repeat = max(1, math.ceil(3 * D / 7))
    min_distinct = min(max(3, round(8 * D / 7)), len(cand))
    out_of_stock = set(household.out_of_stock)

    # ---- model ----
    model = cp_model.CpModel()
    x = {m.id: model.NewIntVar(0, D, f"x_{m.id}") for m in cand}
    used = {m.id: model.NewBoolVar(f"u_{m.id}") for m in cand}
    y = {}
    for i in used_ids:
        ub = 0 if i in out_of_stock else 20
        y[i] = model.NewIntVar(0, ub, f"y_{i}")

    for m in cand:
        model.Add(x[m.id] <= D * used[m.id])
        model.Add(used[m.id] <= x[m.id])
        model.Add(x[m.id] <= max_repeat)
    model.Add(sum(used.values()) >= min_distinct)

    for slot, need in needed.items():
        slot_meals = [m for m in cand if m.slot == slot]
        terms = [x[m.id] * m.servings for m in slot_meals]
        if need > 0:
            if not terms:
                return None
            model.Add(sum(terms) >= need)
        if terms:
            # Buy what the trip needs plus at most one batch of leftovers, not the whole budget.
            model.Add(sum(terms) <= need + max(m.servings for m in slot_meals))

    for i in used_ids:
        usage = [x[m.id] * m.ingredients[i] for m in cand if i in m.ingredients]
        model.Add(sum(usage) <= y[i] * ingredients[i].package_g + pantry_g[i])

    ebt_spend = sum(y[i] * ingredients[i].price_cents for i in used_ids if ingredients[i].ebt_eligible)
    cash_spend = sum(y[i] * ingredients[i].price_cents for i in used_ids if not ingredients[i].ebt_eligible)
    model.Add(ebt_spend <= household.ebt_cents)
    model.Add(cash_spend <= household.cash_cents)

    def _max_total(n: str) -> int:
        return max(1, sum(max(0, coef[n][m.id]) * max_repeat for m in cand))

    short_kcal100 = model.NewIntVar(0, targets.kcal_min // 100 + 1, "short_kcal100")
    short_protein = model.NewIntVar(0, max(1, targets.protein_g_min), "short_protein")
    short_fiber = model.NewIntVar(0, max(1, targets.fiber_g_min), "short_fiber")
    excess_sodium100 = model.NewIntVar(0, _max_total("sodium") // 100 + 1, "excess_sodium100")
    excess_sugar = model.NewIntVar(0, _max_total("sugar"), "excess_sugar")

    model.Add(sum(x[m.id] * coef["kcal"][m.id] for m in cand) + 100 * short_kcal100 >= targets.kcal_min)
    model.Add(sum(x[m.id] * coef["protein"][m.id] for m in cand) + short_protein >= targets.protein_g_min)
    model.Add(sum(x[m.id] * coef["fiber"][m.id] for m in cand) + short_fiber >= targets.fiber_g_min)
    model.Add(sum(x[m.id] * coef["sodium"][m.id] for m in cand) - 100 * excess_sodium100 <= targets.sodium_mg_max)
    model.Add(sum(x[m.id] * coef["sugar"][m.id] for m in cand) - excess_sugar <= targets.sugar_g_max)

    # Objective scaled by 100 so every weight stays an integer (spec weights are per-dollar).
    budget = household.ebt_cents + household.cash_cents
    model.Maximize(
        10000 * sum(x[m.id] * m.palatability for m in cand)
        - 200 * short_kcal100
        - 2000 * short_protein
        - 1000 * short_fiber
        - 100 * excess_sodium100
        - 500 * excess_sugar
        + (budget - (ebt_spend + cash_spend))
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.num_workers = 8
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    # ---- output; every display number is computed here ----
    chosen = {m.id: solver.Value(x[m.id]) for m in cand if solver.Value(x[m.id]) > 0}

    cart: list[PlanItem] = []
    ebt_cents = 0
    cash_cents = 0
    for i in used_ids:
        packs = solver.Value(y[i])
        if packs <= 0:
            continue
        ing = ingredients[i]
        line = packs * ing.price_cents
        if ing.ebt_eligible:
            ebt_cents += line
        else:
            cash_cents += line
        cart.append(PlanItem(ingredient_id=i, packages=packs, line_cents=line,
                             ebt_eligible=ing.ebt_eligible, aisle=ing.aisle))

    basket_cents = ebt_cents + cash_cents
    from_pantry: dict[str, int] = {}
    for i in used_ids:
        grams_used = sum(chosen.get(m.id, 0) * m.ingredients[i] for m in cand if i in m.ingredients)
        taken = min(pantry_g[i], grams_used)
        if taken > 0:
            from_pantry[i] = taken

    achieved = {n: float(sum(chosen.get(m.id, 0) * coef[n][m.id] for m in cand)) for n in NUTRIENTS}
    shortfalls = {
        "kcal": max(0.0, targets.kcal_min - achieved["kcal"]),
        "protein": max(0.0, targets.protein_g_min - achieved["protein"]),
        "fiber": max(0.0, targets.fiber_g_min - achieved["fiber"]),
        "sodium": max(0.0, achieved["sodium"] - targets.sodium_mg_max),
        "sugar": max(0.0, achieved["sugar"] - targets.sugar_g_max),
    }

    return Plan(
        meals=chosen,
        cart=cart,
        ebt_cents=ebt_cents,
        cash_cents=cash_cents,
        basket_cents=basket_cents,
        cash_remaining_cents=household.cash_cents - cash_cents,
        eligible_pct=round(100 * ebt_cents / basket_cents) if basket_cents else 0,
        trips_covered=round(household.ebt_cents / ebt_cents, 1) if ebt_cents else 0.0,
        covers_until=date.today() + timedelta(days=D),
        from_pantry=from_pantry,
        nutrition=achieved,
        targets=targets,
        shortfalls=shortfalls,
        what_changed=None,
        solve_ms=int((time.perf_counter() - started) * 1000),
    )
