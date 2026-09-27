import { useState } from "react";
import { UtensilsCrossed, X } from "lucide-react";
import type { Household, Ingredient, Meal, Slot } from "../types";

const SLOTS: Slot[] = ["breakfast", "lunch", "dinner"];
const SLOT_LABEL: Record<Slot, string> = { breakfast: "Breakfasts", lunch: "Lunches", dinner: "Dinners" };

/** Accept/reject checklist. A filter on the candidate pool; never calls the LLM. */
export default function MealDrawer({
  meals,
  ingredients,
  household,
  error,
  onChangeAccepted,
  onUndoNotForMe,
}: {
  meals: Record<string, Meal>;
  ingredients: Record<string, Ingredient>;
  household: Household;
  error: string | null;
  onChangeAccepted: (ids: string[] | null) => void;
  onUndoNotForMe: (mealId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pool = Object.values(meals);
  const excluded = new Set(household.excluded_meals);
  const accepted = household.accepted_meals === null ? null : new Set(household.accepted_meals);
  const selectable = pool.filter((m) => !excluded.has(m.id));
  const isChecked = (id: string) => !excluded.has(id) && (accepted === null || accepted.has(id));

  const toggle = (id: string) => {
    const next = new Set(selectable.filter((m) => isChecked(m.id)).map((m) => m.id));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChangeAccepted(next.size === selectable.length ? null : Array.from(next));
  };

  const summary = (m: Meal) => {
    const names = Object.keys(m.ingredients).map((i) => ingredients[i]?.name ?? i);
    return names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : "");
  };

  return (
    <>
      <button type="button" className="btn-line" onClick={() => setOpen(true)}>
        <UtensilsCrossed className="ic" aria-hidden="true" />
        Choose from {pool.length} meals
      </button>

      {open && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Choose your meals">
          <div className="sheet__backdrop" onClick={() => setOpen(false)} />
          <div className="sheet__panel stack">
            <div className="sheet__handle" />
            <div className="topbar" style={{ marginBottom: 0 }}>
              <h2>Choose your meals</h2>
              <button type="button" className="iconbtn" aria-label="Close" onClick={() => setOpen(false)}>
                <X className="ic" aria-hidden="true" />
              </button>
            </div>
            <p className="quiz-sub" style={{ marginBottom: 6 }}>
              Uncheck anything you don't want this trip. The plan updates as you go.
            </p>
            {error && <p className="warnbox">Pick a few more meals so every day is covered.</p>}

            {SLOTS.map((slot) => {
              const group = pool.filter((m) => m.slot === slot);
              if (!group.length) return null;
              return (
                <section key={slot}>
                  <h3 className="section-title section-title--sm" style={{ marginBottom: 4 }}>{SLOT_LABEL[slot]}</h3>
                  {group.map((m) => {
                    const gone = excluded.has(m.id);
                    return (
                      <label key={m.id} className="checkrow">
                        <input type="checkbox" checked={isChecked(m.id)} disabled={gone} onChange={() => toggle(m.id)} aria-label={m.name} />
                        <span className="grow">
                          <span className={gone ? "muted" : ""}>{m.name}</span>
                          <br />
                          <span className="subnote">
                            {m.prep_min} min · {summary(m)}
                          </span>
                        </span>
                        {gone && (
                          <span className="row" style={{ gap: 6 }}>
                            <span className="tag unv">Not for me</span>
                            <button type="button" className="link" style={{ fontSize: 13, minHeight: 32 }} onClick={() => onUndoNotForMe(m.id)}>
                              Undo
                            </button>
                          </span>
                        )}
                      </label>
                    );
                  })}
                </section>
              );
            })}
            <button type="button" className="btn-primary" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
