// Detected + manual pantry items on the Pantry screen: a chip per item (tap to cycle full/half/low,
// × to drop it) plus a searchable "+ add item" control. Confirm lives in the parent (Pantry.tsx)
// because it needs household/plan context; this component only edits the working item list.
import { useState } from "react";
import { useApp } from "../state";
import type { PantryLevel } from "../types";

const LEVELS: PantryLevel[] = ["full", "half", "low"];

export default function PantryChecklist() {
  const { ingredients, pantryItems, setPantryItems } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");

  const items = pantryItems.filter((p) => p.source !== "staple");

  function cycleLevel(id: string) {
    setPantryItems(
      pantryItems.map((p) =>
        p.ingredient_id === id
          ? { ...p, level: LEVELS[(LEVELS.indexOf(p.level) + 1) % LEVELS.length] }
          : p,
      ),
    );
  }

  function removeItem(id: string) {
    setPantryItems(pantryItems.filter((p) => p.ingredient_id !== id));
  }

  function addItem(id: string) {
    const rest = pantryItems.filter((p) => p.ingredient_id !== id);
    setPantryItems([...rest, { ingredient_id: id, level: "full", source: "manual" }]);
    setAddOpen(false);
    setQuery("");
  }

  const alreadyListed = new Set(pantryItems.map((p) => p.ingredient_id));
  const results = Object.values(ingredients)
    .filter((i) => !alreadyListed.has(i.id))
    .filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 40);

  return (
    <section style={{ marginBottom: 22 }}>
      <h3 className="section-title section-title--sm">On hand</h3>
      {items.length === 0 ? (
        <p className="subnote" style={{ marginBottom: 10 }}>
          Nothing added yet. Snap a photo, type what you have, or add an item below.
        </p>
      ) : (
        <div className="plist" style={{ marginBottom: 12 }}>
          {items.map((item) => {
            const name = ingredients[item.ingredient_id]?.name ?? item.ingredient_id;
            return (
              <div key={item.ingredient_id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  className="chip new"
                  onClick={() => cycleLevel(item.ingredient_id)}
                  aria-label={`Amount of ${name}: ${item.level}. Tap to change.`}
                >
                  {name} · {item.level}
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => removeItem(item.ingredient_id)}
                  style={{
                    border: "none",
                    background: "none",
                    color: "var(--ink-soft)",
                    fontSize: 18,
                    lineHeight: 1,
                    width: 32,
                    height: 32,
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" className="btn-line" onClick={() => setAddOpen(true)}>
        + Add item
      </button>

      {addOpen && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Add an item">
          <div className="sheet__backdrop" onClick={() => setAddOpen(false)} />
          <div className="sheet__panel stack">
            <div className="sheet__handle" />
            <h2>Add an item</h2>
            <input
              type="text"
              placeholder="Search ingredients"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="stack stack--tight">
              {results.length === 0 && <p className="muted small">No matches.</p>}
              {results.map((ing) => (
                <button
                  key={ing.id}
                  type="button"
                  className="btn-line"
                  style={{ justifyContent: "flex-start" }}
                  onClick={() => addItem(ing.id)}
                >
                  {ing.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
