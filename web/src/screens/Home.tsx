import { useState } from "react";
import { AlertCircle, Leaf } from "lucide-react";
import { daysUntil, fmtDate } from "../format";
import { useApp } from "../state";
import type { Meal, MealFacts } from "../types";
import MealCard, { type MealBadge } from "../components/MealCard";
import MealDetail from "../components/MealDetail";

type Filter = "all" | "quick" | "budget" | "high-protein" | "high-fiber" | "no-cook" | "microwave" | "oven";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "quick", label: "Quick" },
  { key: "budget", label: "Budget pick" },
  { key: "high-protein", label: "High protein" },
  { key: "high-fiber", label: "High fiber" },
  { key: "no-cook", label: "No-cook" },
  { key: "microwave", label: "Microwave" },
  { key: "oven", label: "Oven" },
];

/** Factual labels for the pills under a card, in display priority; at most two are shown. */
const TAG_LABEL: [string, string][] = [
  ["high-protein", "High protein"],
  ["high-fiber", "High fiber"],
  ["budget", "Budget pick"],
  ["quick", "Quick"],
  ["no-cook", "No cooking"],
];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function tagPills(f: MealFacts | undefined): string[] {
  if (!f) return [];
  return TAG_LABEL.filter(([tag]) => f.tags.includes(tag))
    .slice(0, 2)
    .map(([, label]) => label);
}

function SkeletonRow() {
  return (
    <div className="home-skel" aria-hidden="true">
      <div className="skeleton home-skel__photo" />
      <div className="home-skel__lines">
        <div className="skeleton" style={{ width: "70%" }} />
        <div className="skeleton" style={{ width: "90%", minHeight: 12 }} />
        <div className="skeleton" style={{ width: "40%", minHeight: 12 }} />
      </div>
    </div>
  );
}

export default function Home() {
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

  const pool = Object.values(meals);
  const excluded = new Set(household.excluded_meals);
  const factsFor = (id: string): MealFacts | undefined => facts[id];
  const passes = (m: Meal) => filter === "all" || (factsFor(m.id)?.tags.includes(filter) ?? false);
  const byCost = (a: Meal, b: Meal) => {
    const ca = factsFor(a.id)?.serving_cents;
    const cb = factsFor(b.id)?.serving_cents;
    if (ca === undefined && cb === undefined) return a.name.localeCompare(b.name);
    if (ca === undefined) return 1;
    if (cb === undefined) return -1;
    return ca - cb || a.name.localeCompare(b.name);
  };

  const inPlan = pool.filter((m) => !!plan?.meals[m.id] && !excluded.has(m.id)).sort(byCost);
  const others = pool.filter((m) => !plan?.meals[m.id] && !excluded.has(m.id)).sort(byCost);
  const muted = pool.filter((m) => excluded.has(m.id)).sort(byCost);
  const rows: { meal: Meal; badge: MealBadge }[] = [
    ...inPlan.map((meal) => ({ meal, badge: "in" as MealBadge })),
    ...others.map((meal) => ({ meal, badge: "out" as MealBadge })),
    ...muted.map((meal) => ({ meal, badge: "muted" as MealBadge })),
  ].filter(({ meal }) => passes(meal));

  const days = daysUntil(household.deposit_date);
  const amt = days !== null && days >= 0 ? `${plural(days, "day")} until deposit` : `Covers ${plural(household.trip_days, "day")}`;
  const pct = plan?.eligible_pct ?? 0;
  const pinsRelaxed = plan?.relaxed.includes("pins") ?? false;

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="eyebrow">
            {greeting()} <span className="pill">{household.snap_only ? "SNAP only" : "SNAP + cash"}</span>
          </div>
          <h2>Ready to cook?</h2>
        </div>
        <button type="button" className="iconbtn iconbtn--gold" aria-label="Profile" onClick={() => navigate("/profile")}>
          <Leaf className="ic" aria-hidden="true" />
        </button>
      </div>

      <section className={`budget-card home-hero${solving ? " loading" : ""}`} aria-label="This trip at a glance">
        <div
          className="ring"
          role="img"
          aria-label={plan ? `${pct}% SNAP-eligible` : "Planning"}
          style={{ background: `conic-gradient(var(--gold) 0% ${pct}%, rgba(241, 238, 221, 0.2) ${pct}% 100%)` }}
        >
          <span>{plan ? `${pct}%` : "–"}</span>
        </div>
        <div className="home-hero__text">
          <div className="label">SNAP-eligible so far</div>
          {plan ? (
            <>
              <div className="amt">{amt}</div>
              <div className="sub">Covers you until {fmtDate(plan.covers_until)}</div>
            </>
          ) : (
            <>
              <div className="skeleton home-hero__skel" />
              <div className="skeleton home-hero__skel home-hero__skel--sub" />
            </>
          )}
        </div>
        <button type="button" className="link-quiet" onClick={() => navigate("/plan")}>
          View plan ›
        </button>
      </section>

      {pinsRelaxed && (
        <div className="infobox" role="status">
          <AlertCircle className="ic" aria-hidden="true" />
          <span>One of your pinned meals didn't fit this trip's budget. It stays pinned for next time.</span>
        </div>
      )}

      <div className="home-chips" role="group" aria-label="Filter meals">
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

      <section aria-label="Meals">
        <div className="home-section-head">
          <h3 className="section-title">Picked for your budget</h3>
          <span className="subnote">Sorted by cost per serving</span>
        </div>

        {pool.length === 0 ? (
          <div className="home-list">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : rows.length === 0 ? (
          <p className="subnote">No meals match this filter.</p>
        ) : (
          <div className="home-list">
            {rows.map(({ meal, badge }) => {
              const f = factsFor(meal.id);
              const pills = tagPills(f);
              const cls = `home-meal${pills.length ? " home-meal--tagged" : ""}${badge === "muted" ? " home-meal--muted" : ""}${solving ? " loading" : ""}`;
              const onBadge =
                badge === "in" ? () => skipMeal(meal.id) : badge === "out" ? () => pinMeal(meal.id) : undefined;
              return (
                <div key={meal.id} className={cls}>
                  <MealCard
                    meal={meal}
                    servingCents={f?.serving_cents}
                    times={badge === "in" ? plan?.meals[meal.id] : undefined}
                    badge={badge}
                    onOpen={() => setOpenMeal(meal)}
                    onBadge={onBadge}
                  />
                  {pills.length > 0 && (
                    <div className="home-tags">
                      {pills.map((p) => (
                        <span key={p} className="tag fact">{p}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

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
