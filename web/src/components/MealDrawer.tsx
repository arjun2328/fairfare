import { useState } from "react";
import { UtensilsCrossed, X } from "lucide-react";
import type { Household, Ingredient, Meal, MealFacts, Plan, Slot } from "../types";
import MealCard, { type MealBadge } from "./MealCard";
import MealDetail from "./MealDetail";

const SLOTS: Slot[] = ["breakfast", "lunch", "dinner"];
const SLOT_LABEL: Record<Slot, string> = { breakfast: "Breakfasts", lunch: "Lunches", dinner: "Dinners" };

type Filter = "all" | Slot | "quick" | "nocook" | "microwave";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "quick", label: "Quick" },
  { key: "nocook", label: "No-cook" },
  { key: "microwave", label: "Microwave" },
];

function matches(m: Meal, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    case "quick":
      return m.prep_min <= 15;
    case "nocook":
      return m.equipment.length === 0;
    case "microwave":
      return m.equipment.includes("microwave");
    default:
      return m.slot === f;
  }
}

/** Accept/reject chooser as a photo list. A filter on the candidate pool; never calls the LLM. */
export default function MealDrawer({
  meals,
  ingredients,
  household,
  plan,
  facts,
  error,
  onChangeAccepted,
  onUndoNotForMe,
  onNotForMe,
  onPin,
  onUnpin,
}: {
  meals: Record<string, Meal>;
  ingredients: Record<string, Ingredient>;
  household: Household;
  plan: Plan | null;
  facts: Record<string, MealFacts>;
  error: string | null;
  onChangeAccepted: (ids: string[] | null) => void;
  onUndoNotForMe: (mealId: string) => void;
  onNotForMe: (mealId: string) => void;
  onPin: (mealId: string) => void;
  onUnpin: (mealId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  const pool = Object.values(meals);
  const excluded = new Set(household.excluded_meals);
  const accepted = household.accepted_meals === null ? null : new Set(household.accepted_meals);
  const pinnedSet = new Set(household.required_meals ?? []);
  const selectable = pool.filter((m) => !excluded.has(m.id));
  const isChecked = (id: string) => !excluded.has(id) && (accepted === null || accepted.has(id));

  /** Flip one meal in or out of accepted_meals; everything selectable checked means "no filter" (null). */
  const toggle = (id: string) => {
    if (excluded.has(id)) return;
    const next = new Set(selectable.filter((m) => isChecked(m.id)).map((m) => m.id));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChangeAccepted(next.size === selectable.length ? null : Array.from(next));
  };

  const badgeFor = (id: string): MealBadge => (excluded.has(id) ? "muted" : isChecked(id) ? "in" : "out");
  const servingCents = (id: string): number | undefined => facts[id]?.serving_cents ?? plan?.meal_serving_cents?.[id];
  const timesFor = (id: string): number | undefined => plan?.meals?.[id];

  const filtered = pool.filter((m) => matches(m, filter));
  const detail = detailId ? meals[detailId] ?? null : null;

  const renderCard = (m: Meal) => (
    <MealCard
      key={m.id}
      meal={m}
      servingCents={servingCents(m.id)}
      times={timesFor(m.id)}
      badge={badgeFor(m.id)}
      onOpen={() => setDetailId(m.id)}
      onBadge={excluded.has(m.id) ? undefined : () => toggle(m.id)}
    />
  );

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
            <p className="quiz-sub" style={{ marginBottom: 0 }}>
              Tap the circle to add or skip a meal. Tap a card to see it. The plan updates as you go.
            </p>
            {error && <p className="warnbox">Pick a few more meals so every day is covered.</p>}

            <div className="meal-filters" role="group" aria-label="Filter meals">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`chip${filter === key ? " new" : ""}`}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {filtered.length === 0 && <p className="subnote">No meals match this filter.</p>}

            {filter === "all" ? (
              SLOTS.map((slot) => {
                const group = filtered.filter((m) => m.slot === slot);
                if (!group.length) return null;
                return (
                  <section key={slot} className="meal-group">
                    <h3 className="section-title section-title--sm meal-group__title">{SLOT_LABEL[slot]}</h3>
                    <div className="meal-list">{group.map(renderCard)}</div>
                  </section>
                );
              })
            ) : (
              <div className="meal-list">{filtered.map(renderCard)}</div>
            )}

            <button type="button" className="btn-primary" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      <MealDetail
        meal={detail}
        ingredients={ingredients}
        facts={detail ? facts[detail.id] : undefined}
        times={detail ? timesFor(detail.id) : undefined}
        excluded={detail ? excluded.has(detail.id) : false}
        included={detail ? isChecked(detail.id) : false}
        pinned={detail ? pinnedSet.has(detail.id) : false}
        onClose={() => setDetailId(null)}
        onNotForMe={onNotForMe}
        onUndoNotForMe={onUndoNotForMe}
        onSkip={toggle}
        onInclude={toggle}
        onPin={onPin}
        onUnpin={onUnpin}
      />
    </>
  );
}
