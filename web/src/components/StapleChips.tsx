// Staples row on Pantry: chips for every Ingredient.staple, all "on" (assumed on hand) by default.
// Deselecting a chip turns off assume_staples for the whole household and instead lists the
// still-selected staples explicitly as PantryItems so the solver keeps crediting them.
import { useApp } from "../state";
import type { PantryItem } from "../types";

export default function StapleChips() {
  const { household, ingredients, pantryItems, setHousehold, setPantryItems } = useApp();
  if (!household) return null;

  const staples = Object.values(ingredients)
    .filter((i) => i.staple)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (staples.length === 0) return null;

  const staplePantryIds = new Set(
    pantryItems.filter((p) => p.source === "staple").map((p) => p.ingredient_id),
  );
  const isSelected = (id: string) => (household.assume_staples ? true : staplePantryIds.has(id));

  function toggle(id: string) {
    const currentlySelected = staples.filter((s) => isSelected(s.id)).map((s) => s.id);
    const nowSelected = currentlySelected.includes(id)
      ? currentlySelected.filter((x) => x !== id)
      : [...currentlySelected, id];
    const nonStapleItems = pantryItems.filter((p) => p.source !== "staple");

    if (nowSelected.length === staples.length) {
      setHousehold({ assume_staples: true });
      setPantryItems(nonStapleItems);
    } else {
      const stapleItems: PantryItem[] = nowSelected.map((sid) => ({
        ingredient_id: sid,
        level: "full",
        source: "staple",
      }));
      setHousehold({ assume_staples: false });
      setPantryItems([...nonStapleItems, ...stapleItems]);
    }
  }

  return (
    <section style={{ marginBottom: 22 }}>
      <h3 className="section-title section-title--sm">Staples on hand</h3>
      <p className="subnote" style={{ marginBottom: 10 }}>Tap anything you're out of.</p>
      <div className="plist">
        {staples.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip${isSelected(s.id) ? "" : " off"}`}
            aria-pressed={isSelected(s.id)}
            onClick={() => toggle(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
    </section>
  );
}
