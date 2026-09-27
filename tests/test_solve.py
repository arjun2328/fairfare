from stretch.nutrition import targets_for
from stretch.solve import solve
from tests.fixtures import INGREDIENTS, MEALS, make_household

MEALS_BY_ID = {m.id: m for m in MEALS}


def _solve(hh):
    return solve(MEALS, INGREDIENTS, hh, targets_for(hh))


def _grams_used(plan) -> dict[str, int]:
    used: dict[str, int] = {}
    for mid, times in plan.meals.items():
        for iid, grams in MEALS_BY_ID[mid].ingredients.items():
            used[iid] = used.get(iid, 0) + times * grams
    return used


def _total_servings(plan) -> int:
    return sum(times * MEALS_BY_ID[mid].servings for mid, times in plan.meals.items())


def test_returns_plan():
    plan = _solve(make_household())
    assert plan is not None
    assert plan.meals
    assert plan.cart


def test_ingredient_sufficiency():
    hh = make_household()
    plan = _solve(hh)
    packs = {c.ingredient_id: c.packages for c in plan.cart}
    for iid, grams in _grams_used(plan).items():
        ing = INGREDIENTS[iid]
        pantry = hh.pantry.get(iid, 0)
        if hh.assume_staples and ing.staple:
            pantry = max(pantry, ing.package_g)
        assert grams <= packs.get(iid, 0) * ing.package_g + pantry, iid


def test_budgets_and_totals_agree():
    hh = make_household()
    plan = _solve(hh)
    assert plan.ebt_cents <= hh.ebt_cents
    assert plan.cash_cents <= hh.cash_cents
    line_sum = sum(c.line_cents for c in plan.cart)
    assert plan.ebt_cents + plan.cash_cents == line_sum == plan.basket_cents
    assert plan.cash_remaining_cents == hh.cash_cents - plan.cash_cents


def test_out_of_stock_removes_ingredient():
    # rotisserie_chicken is unique to one dinner; with trip_days=4 the variety floor is 5 of 6
    # meals, so the solver is free to drop that dinner rather than fail.
    base = _solve(make_household(trip_days=4))
    assert any(c.ingredient_id == "rotisserie_chicken" for c in base.cart)
    plan = _solve(make_household(trip_days=4, out_of_stock=["rotisserie_chicken"]))
    assert plan is not None
    assert all(c.ingredient_id != "rotisserie_chicken" for c in plan.cart)


def test_pantry_reduces_packages():
    base = _solve(make_household())
    target = next(c for c in base.cart if not INGREDIENTS[c.ingredient_id].staple)
    hh = make_household(pantry={target.ingredient_id: INGREDIENTS[target.ingredient_id].package_g})
    plan = _solve(hh)
    after = next((c.packages for c in plan.cart if c.ingredient_id == target.ingredient_id), 0)
    assert after <= target.packages - 1
    assert plan.from_pantry.get(target.ingredient_id, 0) > 0


def test_fewer_days_fewer_servings():
    short = _solve(make_household(trip_days=3))
    long = _solve(make_household(trip_days=7))
    assert _total_servings(short) < _total_servings(long)


def test_servings_capped_near_need():
    hh = make_household()
    plan = _solve(hh)
    for slot in ("breakfast", "lunch", "dinner"):
        slot_meals = [m for m in MEALS if m.slot == slot]
        served = sum(times * MEALS_BY_ID[mid].servings for mid, times in plan.meals.items()
                     if MEALS_BY_ID[mid].slot == slot)
        need = hh.trip_days * hh.people
        assert need <= served <= need + max(m.servings for m in slot_meals), slot


def test_staples_not_bought_when_assumed():
    hh = make_household(assume_staples=True)
    plan = _solve(hh)
    used = _grams_used(plan)
    for c in plan.cart:
        ing = INGREDIENTS[c.ingredient_id]
        if ing.staple:
            assert used.get(c.ingredient_id, 0) > ing.package_g, "staple bought before pantry exhausted"
    assert "vegetable_oil" not in {c.ingredient_id for c in plan.cart}
