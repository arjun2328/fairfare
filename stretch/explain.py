from . import llm
from .schemas import Ingredient, Meal, Plan


def diff(old: Plan, new: Plan, meals: dict[str, Meal], ingredients: dict[str, Ingredient]) -> dict:
    """Pure-Python comparison of two plans: meals, cart lines, totals and nutrients."""
    def meal_name(mid: str) -> str:
        m = meals.get(mid)
        return m.name if m else mid

    def ing_name(iid: str) -> str:
        i = ingredients.get(iid)
        return i.name if i else iid

    old_packs = {c.ingredient_id: c.packages for c in old.cart}
    new_packs = {c.ingredient_id: c.packages for c in new.cart}

    added_ing = [ing_name(i) for i in new_packs if i not in old_packs]
    removed_ing = [ing_name(i) for i in old_packs if i not in new_packs]
    changed_ing = [
        {"name": ing_name(i), "from": old_packs[i], "to": new_packs[i]}
        for i in new_packs if i in old_packs and old_packs[i] != new_packs[i]
    ]

    nutrients = {}
    for key, value in new.nutrition.items():
        delta = round(value - old.nutrition.get(key, 0.0), 1)
        if delta:
            nutrients[key] = delta

    return {
        "meals_added": [meal_name(m) for m in new.meals if m not in old.meals],
        "meals_removed": [meal_name(m) for m in old.meals if m not in new.meals],
        "ingredients_added": added_ing,
        "ingredients_removed": removed_ing,
        "ingredients_changed": changed_ing,
        "ebt_delta_cents": new.ebt_cents - old.ebt_cents,
        "cash_delta_cents": new.cash_cents - old.cash_cents,
        "basket_delta_cents": new.basket_cents - old.basket_cents,
        "nutrients_delta": nutrients,
        "targets_met_now": all(v == 0 for v in new.shortfalls.values()),
        "targets_met_before": all(v == 0 for v in old.shortfalls.values()),
    }


def explain(old: Plan, new: Plan, meals, ingredients) -> str:
    """Two plain sentences about what changed between two plans."""
    d = diff(old, new, meals, ingredients)
    if not any([d["meals_added"], d["meals_removed"], d["ingredients_added"],
                d["ingredients_removed"], d["ingredients_changed"],
                d["ebt_delta_cents"], d["cash_delta_cents"]]):
        return "No changes."

    prompt = (
        "You are describing a change to a grocery plan for a household paying with SNAP. "
        "Write exactly two sentences in plain language. Mention the dollars saved or spent "
        "and whether nutrition targets are still met. No bullet points, no headers, no "
        "health advice. Amounts below are in cents; write them as dollars.\n\n"
        f"{d}"
    )
    reply = llm.complete([{"role": "user", "content": prompt}], temperature=0.3)
    return (reply["text"] or "").strip() or "No changes."
