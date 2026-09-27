import { useState } from "react";
import { Check, Leaf } from "lucide-react";
import { fmtMoney } from "../format";
import { useApp } from "../state";
import type { Meal, MealFacts, Slot } from "../types";
import MealPhoto from "../components/MealPhoto";
import MealDetail from "../components/MealDetail";

type Filter = "all" | Slot;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

function SkeletonTile() {
  return (
    <div className="cook-tile" aria-hidden="true">
      <div className="skeleton" style={{ width: "100%", height: 110, borderRadius: 14 }} />
      <div className="skeleton" style={{ width: "80%" }} />
      <div className="skeleton" style={{ width: "55%", minHeight: 12 }} />
    </div>
  );
}

export default function Cookbook() {
  const {
    household,
    plan,
    meals,
    ingredients,
    facts,
    solving,
    setHousehold,
    pinMeal,
    unpinMeal,
    skipMeal,
    includeMeal,
    navigate,
  } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  if (!household) return null;

  // Same two helpers as Plan.tsx: "Not for me" is a filter on the candidate pool, never an LLM call.
  const notForMe = (id: string) => setHousehold({ excluded_meals: Array.from(new Set([...household.excluded_meals, id])) });
  const undoNotForMe = (id: string) => setHousehold({ excluded_meals: household.excluded_meals.filter((x) => x !== id) });
  const isIncluded = (id: string) => household.accepted_meals === null || household.accepted_meals.includes(id);
  const isPinned = (id: string) => household.required_meals.includes(id);

  const excluded = new Set(household.excluded_meals);
  const factsFor = (id: string): MealFacts | undefined => facts[id];
  const byName = (a: Meal, b: Meal) => a.name.localeCompare(b.name);
  const pool = Object.values(meals);
  const visible = pool.filter((m) => filter === "all" || m.slot === filter);
  const inPlan = visible.filter((m) => !!plan?.meals[m.id] && !excluded.has(m.id)).sort(byName);
  const rest = visible.filter((m) => !plan?.meals[m.id] && !excluded.has(m.id)).sort(byName);
  const muted = visible.filter((m) => excluded.has(m.id)).sort(byName);
  const tiles = [...inPlan, ...rest, ...muted];

  return (
    <div className="screen">
      <div className="topbar">
        <h2>Cookbook</h2>
        <button type="button" className="iconbtn iconbtn--gold" aria-label="Profile" onClick={() => navigate("/profile")}>
          <Leaf className="ic" aria-hidden="true" />
        </button>
      </div>

      <div className="home-chips" role="group" aria-label="Filter by meal">
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

      {pool.length === 0 ? (
        <div className="cook-grid">
          <SkeletonTile />
          <SkeletonTile />
          <SkeletonTile />
          <SkeletonTile />
        </div>
      ) : tiles.length === 0 ? (
        <p className="subnote">No meals match this filter.</p>
      ) : (
        <div className={`cook-grid${solving ? " loading" : ""}`}>
          {tiles.map((m) => {
            const f = factsFor(m.id);
            const inThisPlan = !!plan?.meals[m.id] && !excluded.has(m.id);
            const isMuted = excluded.has(m.id);
            const sub = f ? `${fmtMoney(f.serving_cents)}/serving · ${m.prep_min} min` : `${m.prep_min} min`;
            return (
              <button
                key={m.id}
                type="button"
                className={`cook-tile${isMuted ? " cook-tile--muted" : ""}`}
                onClick={() => setOpenMeal(m)}
              >
                <div className="cook-tile__photo">
                  <MealPhoto meal={m} variant="card" />
                  {inThisPlan && (
                    <span className="cook-tile__badge" role="img" aria-label="In your plan">
                      <Check className="ic" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <span className="cook-tile__name">{m.name}</span>
                {isMuted && <span className="tag mute">Not for me</span>}
                <span className="subnote cook-tile__sub">{sub}</span>
              </button>
            );
          })}
        </div>
      )}

      <MealDetail
        meal={openMeal}
        ingredients={ingredients}
        facts={openMeal ? factsFor(openMeal.id) : undefined}
        times={openMeal ? plan?.meals[openMeal.id] : undefined}
        excluded={openMeal ? excluded.has(openMeal.id) : false}
        included={openMeal ? isIncluded(openMeal.id) : true}
        pinned={openMeal ? isPinned(openMeal.id) : false}
        onClose={() => setOpenMeal(null)}
        onNotForMe={notForMe}
        onUndoNotForMe={undoNotForMe}
        onSkip={skipMeal}
        onInclude={includeMeal}
        onPin={pinMeal}
        onUnpin={unpinMeal}
      />
    </div>
  );
}
