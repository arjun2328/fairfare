import json
import os
import re

from . import llm
from .schemas import Household, Ingredient, Meal

_RULES = (
    "Use only these ingredient ids. All quantities are grams per batch (integers). "
    'Output JSON only, as an object {"meals": [ ... ]}, with no prose and no markdown fences. '
    'Each meal object: {"id", "name", "slot", "servings", "prep_min", "equipment", '
    '"palatability", "ingredients"}. slot is breakfast|lunch|dinner. equipment is a list '
    "drawn from stovetop|microwave|oven. palatability is 1-5. ingredients maps ingredient_id "
    "to grams per batch. id is a unique snake_case string made from the name, "
    'e.g. "oatmeal_with_bananas", never a number.'
)


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "meal"


def _ingredient_lines(ingredients: dict[str, Ingredient]) -> str:
    return "\n".join(f"{i.id}: {i.name}" for i in ingredients.values())


def _parse(text: str, ingredients: dict[str, Ingredient]) -> list[Meal]:
    payload = json.loads(text)
    if isinstance(payload, dict):
        for key in ("meals", "data", "items", "result"):
            if isinstance(payload.get(key), list):
                payload = payload[key]
                break
        else:
            lists = [v for v in payload.values() if isinstance(v, list)]
            if lists:
                payload = lists[0]
    if not isinstance(payload, list):
        raise ValueError("model did not return a JSON array of meals")

    meals: list[Meal] = []
    seen_names: set[str] = set()
    seen_ids: set[str] = set()
    dropped = 0
    first_error = ""
    for raw in payload:
        if isinstance(raw, dict) and not isinstance(raw.get("id"), str):
            raw = {**raw, "id": _slug(str(raw.get("name", "")))}
        try:
            meal = Meal.model_validate(raw)
        except Exception as exc:
            dropped += 1
            first_error = first_error or str(exc).splitlines()[0]
            continue
        if any(i not in ingredients for i in meal.ingredients) or not meal.ingredients:
            dropped += 1
            continue
        key = meal.name.strip().lower()
        if key in seen_names or meal.id in seen_ids:
            dropped += 1
            continue
        seen_names.add(key)
        seen_ids.add(meal.id)
        meals.append(meal)
    print(f"generate: kept {len(meals)} meals, dropped {dropped}"
          + (f" (first error: {first_error})" if first_error else ""))
    return meals


def generate_meals(ingredients: dict[str, Ingredient],
                   household: Household,
                   n: int = 50,
                   cache_path: str = "data/meals.json") -> list[Meal]:
    """Load the cached meal pool if present, otherwise ask the LLM once and cache it."""
    if cache_path and os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as fh:
            return [Meal.model_validate(m) for m in json.load(fh)]

    prompt = (
        f"Propose {n} cheap, simple household meals.\n{_RULES}\n\n"
        f"Aim for about 10 breakfasts, 20 lunches and 20 dinners. Favour meals that share "
        f"staple ingredients (rice, beans, eggs, onions) so one package stretches across "
        f"several meals, and give a range of prep times from 5 to {household.max_prep_min} "
        f"minutes.\n\nIngredients:\n{_ingredient_lines(ingredients)}"
    )
    reply = llm.complete([{"role": "user", "content": prompt}], json_only=True)
    meals = _parse(reply["text"] or "[]", ingredients)

    if cache_path:
        os.makedirs(os.path.dirname(cache_path) or ".", exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as fh:
            json.dump([m.model_dump() for m in meals], fh, indent=1)
    return meals


def load_cached(cache_path: str = "data/meals.json") -> list[Meal]:
    """Read the meal cache without ever calling the LLM; empty list when there is no cache."""
    if not os.path.exists(cache_path):
        return []
    with open(cache_path, encoding="utf-8") as fh:
        return [Meal.model_validate(m) for m in json.load(fh)]


if __name__ == "__main__":
    from .schemas import load_ingredients

    ings = load_ingredients()
    if os.path.exists("data/meals.json"):
        os.remove("data/meals.json")
    hh = Household(people=2, ebt_cents=15000, cash_cents=2000)
    print(f"generated {len(generate_meals(ings, hh))} meals into data/meals.json")
