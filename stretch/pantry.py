import json

from . import llm
from .schemas import Ingredient, PantryItem

_LEVELS = {"full", "half", "low"}


def _ingredient_lines(ingredients: dict[str, Ingredient]) -> str:
    return "\n".join(f"{i.id}: {i.name}" for i in ingredients.values())


def _parse(text: str, ingredients: dict[str, Ingredient], source: str) -> list[PantryItem]:
    try:
        payload = json.loads(text or "[]")
    except json.JSONDecodeError:
        return []
    if isinstance(payload, dict):
        for key in ("items", "pantry", "data", "result"):
            if isinstance(payload.get(key), list):
                payload = payload[key]
                break
        else:
            lists = [v for v in payload.values() if isinstance(v, list)]
            if lists:
                payload = lists[0]
    if not isinstance(payload, list):
        return []

    out: list[PantryItem] = []
    for raw in payload:
        if not isinstance(raw, dict):
            continue
        iid = str(raw.get("ingredient_id", "")).strip()
        level = str(raw.get("level", "full")).strip().lower()
        if iid not in ingredients or level not in _LEVELS:
            continue
        out.append(PantryItem(ingredient_id=iid, level=level, source=source))
    return out


def detect_from_image(image: bytes, ingredients: dict[str, Ingredient]) -> list[PantryItem]:
    """Read a shelf photo into levels the user will confirm; never grams."""
    prompt = (
        "List only items from this list that are clearly visible in the photo. For each give "
        '"ingredient_id" and "level" in {full, half, low}. Return JSON only, as an object {"items": [ ... ]}. Do not guess '
        f"items you cannot see.\n\n{_ingredient_lines(ingredients)}"
    )
    reply = llm.complete([{"role": "user", "content": prompt}], json_only=True, images=[image])
    return _parse(reply["text"], ingredients, "photo")


def detect_from_text(text: str, ingredients: dict[str, Ingredient]) -> list[PantryItem]:
    """Read a typed list of what the household has into levels the user will confirm."""
    prompt = (
        "List only items from this list that the person says they have. For each give "
        '"ingredient_id" and "level" in {full, half, low}. Use "full" unless they say '
        'otherwise. Return JSON only, as an object {"items": [ ... ]}. Do not guess items they did not mention.\n\n'
        f"They said: {text}\n\n{_ingredient_lines(ingredients)}"
    )
    reply = llm.complete([{"role": "user", "content": prompt}], json_only=True)
    return _parse(reply["text"], ingredients, "text")


def to_grams(items: list[PantryItem], ingredients: dict[str, Ingredient]) -> dict[str, int]:
    """Estimated grams on hand per ingredient; duplicates sum."""
    out: dict[str, int] = {}
    for item in items:
        ing = ingredients.get(item.ingredient_id)
        if ing is None:
            continue
        if item.level == "full":
            grams = ing.package_g
        elif item.level == "half":
            grams = ing.package_g // 2
        else:
            grams = ing.package_g // 5
        out[item.ingredient_id] = out.get(item.ingredient_id, 0) + grams
    return out
