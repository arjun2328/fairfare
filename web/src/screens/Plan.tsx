import { useState } from "react";
import { AlertCircle, Leaf, ShoppingBasket, SlidersHorizontal } from "lucide-react";
import { daysUntil, fmtDate, fmtMoney } from "../format";
import { useApp } from "../state";
import type { Household, Meal, NutrientTargets, Plan as PlanT, Slot } from "../types";
import PaymentCard, { uncoveredSentence } from "../components/PaymentCard";
import MealDrawer from "../components/MealDrawer";
import MealCard from "../components/MealCard";
import MealDetail from "../components/MealDetail";
import TodayRow from "../components/TodayRow";
import WeekView from "../components/WeekView";
import AdjustSheet from "../components/AdjustSheet";

const NUTRIENTS: { key: string; label: string; target: keyof NutrientTargets }[] = [
  { key: "kcal", label: "calories", target: "kcal_min" },
  { key: "protein", label: "protein", target: "protein_g_min" },
  { key: "fiber", label: "fiber", target: "fiber_g_min" },
  { key: "sodium", label: "sodium", target: "sodium_mg_max" },
  { key: "sugar", label: "sugar", target: "sugar_g_max" },
];

const SLOT_ORDER: Record<Slot, number> = { breakfast: 0, lunch: 1, dinner: 2 };

/** Dollars typed by the user -> integer cents. The only arithmetic on this screen. */
function toCents(dollars: string): number {
  const n = Number(dollars);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Second hero line: pace against the deposit when a date is set, otherwise the coverage window. */
function paceLine(plan: PlanT, household: Household): { text: string; warn: boolean } {
  const covers = `Covers ${plural(household.trip_days, "day")}`;
  if (!household.deposit_date) return { text: `${covers} · until ${fmtDate(plan.covers_until)}`, warn: false };
  if (plan.on_pace) return { text: `${covers} · on pace to ${fmtDate(household.deposit_date)}`, warn: false };
  const runOut = plan.projected_run_out_date ? `runs out ${fmtDate(plan.projected_run_out_date)}` : "runs out before your deposit";
  return { text: `${covers} · SNAP ${runOut}, ahead of your ${fmtDate(household.deposit_date)} deposit`, warn: true };
}

function PlanForm({ household, onSave }: { household: Household; onSave: (p: Partial<Household>) => void }) {
  const [snap, setSnap] = useState(String(household.ebt_cents / 100));
  const [cash, setCash] = useState(String(household.cash_cents / 100));
  const [date, setDate] = useState(household.deposit_date ?? "");
  const [days, setDays] = useState(household.trip_days);
  const [people, setPeople] = useState(household.people);
  const [prep, setPrep] = useState(household.max_prep_min);

  const save = () =>
    onSave({
      ebt_cents: toCents(snap),
      cash_cents: household.snap_only ? 0 : toCents(cash),
      deposit_date: date || null,
      trip_days: days,
      people,
      max_prep_min: prep,
    });

  return (
    <div>
      <div className="planform">
        <div>
          <label htmlFor="pf-snap">SNAP balance right now</label>
          <input id="pf-snap" type="number" inputMode="decimal" min={0} step="0.01" value={snap} onChange={(e) => setSnap(e.target.value)} />
        </div>
        {!household.snap_only && (
          <div>
            <label htmlFor="pf-cash">Cash available for groceries</label>
            <input id="pf-cash" type="number" inputMode="decimal" min={0} step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
        )}
        <div>
          <label htmlFor="pf-date">Next expected deposit date</label>
          <input id="pf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="row row--between">
          <div>
            <label>Days this trip covers</label>
            <div className="stepper" aria-label="Days this trip covers">
              <button type="button" aria-label="One day fewer" onClick={() => setDays((d) => Math.max(1, d - 1))}>-</button>
              <span>{days}</span>
              <button type="button" aria-label="One day more" onClick={() => setDays((d) => Math.min(14, d + 1))}>+</button>
            </div>
          </div>
          <div>
            <label>People eating</label>
            <div className="stepper" aria-label="People eating">
              <button type="button" aria-label="One person fewer" onClick={() => setPeople((p) => Math.max(1, p - 1))}>-</button>
              <span>{people}</span>
              <button type="button" aria-label="One person more" onClick={() => setPeople((p) => Math.min(12, p + 1))}>+</button>
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="pf-prep">Most minutes you'll spend cooking a meal</label>
          <select id="pf-prep" value={prep} onChange={(e) => setPrep(Number(e.target.value))}>
            {[15, 30, 45, 60].map((m) => (
              <option key={m} value={m}>{m} minutes</option>
            ))}
          </select>
        </div>
      </div>
      <button type="button" className="btn-primary" style={{ marginTop: 8 }} onClick={save}>
        Save changes
      </button>
      <p className="disclaim">Entered manually — not connected to your EBT account.</p>
    </div>
  );
}

function NutritionStrip({ plan }: { plan: PlanT }) {
  return (
    <div className="nutri-row" aria-label="Nutrition this trip">
      {NUTRIENTS.map(({ key, label, target }) => {
        const short = plan.shortfalls[key] ?? 0;
        const goal = plan.targets[target];
        const value = short > 0 && goal > 0 ? `${Math.round((100 * (plan.nutrition[key] ?? 0)) / goal)}%` : "met";
        return (
          <div key={key} className="nstat">
            <b>{value}</b>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Plan() {
  const { household, plan, meals, ingredients, solving, solveError, setHousehold, resetHousehold, navigate } = useApp();
  const [adjusting, setAdjusting] = useState(false);
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  if (!household) return null;

  const notForMe = (id: string) => setHousehold({ excluded_meals: Array.from(new Set([...household.excluded_meals, id])) });
  const undoNotForMe = (id: string) => setHousehold({ excluded_meals: household.excluded_meals.filter((x) => x !== id) });
  const isIncluded = (id: string) => household.accepted_meals === null || household.accepted_meals.includes(id);
  /** Same rule as the chooser: everything selectable checked means "no filter" (null). */
  const toggleIncluded = (id: string) => {
    const selectable = Object.values(meals).filter((m) => !household.excluded_meals.includes(m.id));
    const current = new Set(selectable.filter((m) => isIncluded(m.id)).map((m) => m.id));
    if (current.has(id)) current.delete(id);
    else current.add(id);
    setHousehold({ accepted_meals: current.size === selectable.length ? null : Array.from(current) });
  };

  const days = daysUntil(household.deposit_date);
  const capApplies = days !== null && days > household.trip_days; // the solver paces SNAP across the deposit gap
  const pace = plan ? paceLine(plan, household) : null;
  const uncoveredMsg = plan ? uncoveredSentence(plan.uncovered) : null;
  const staples = plan ? plan.staples_assumed.map((id) => ingredients[id]?.name ?? id) : [];
  const chosen: { meal: Meal; times: number }[] = plan
    ? Object.entries(plan.meals)
        .flatMap(([id, times]) => (meals[id] ? [{ meal: meals[id], times }] : []))
        .sort((a, b) => SLOT_ORDER[a.meal.slot] - SLOT_ORDER[b.meal.slot] || b.times - a.times)
    : [];

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="eyebrow">
            This trip <span className="pill">{household.snap_only ? "SNAP only" : "SNAP + cash"}</span>
          </div>
          <h2>Your plan</h2>
        </div>
        <button type="button" className="adjust-btn" onClick={() => setAdjusting(true)} aria-haspopup="dialog">
          <SlidersHorizontal className="ic" aria-hidden="true" />
          Adjust
        </button>
      </div>

      <section className={`hero${solving ? " loading" : ""}`} aria-label="What this trip costs">
        {plan ? (
          <div className="amt">
            {fmtMoney(plan.basket_cents)}
            <small>this trip</small>
          </div>
        ) : solveError ? (
          <div className="amt quiet">No plan yet</div>
        ) : (
          <div className="skeleton hero-skel" aria-label="Planning" />
        )}
        {plan && pace ? (
          <div className={`pace${pace.warn ? " warn" : ""}`}>
            {pace.warn && <AlertCircle className="ic" aria-hidden="true" />}
            <span>{pace.text}</span>
          </div>
        ) : (
          <div className="pace">
            <span>{solveError ? "Tap Adjust to change the setup, then we'll try again." : "Working it out from real store prices"}</span>
          </div>
        )}
        {plan && (
          <div className="split">
            <span className="money-pill money-snap">SNAP {fmtMoney(plan.ebt_cents)}</span>
            <span className="money-pill money-cash">Cash {fmtMoney(plan.cash_cents)}</span>
          </div>
        )}
      </section>

      {solveError && (
        <div className="warnbox" role="alert" style={{ marginTop: 0, marginBottom: 16 }}>
          <AlertCircle className="ic" aria-hidden="true" />
          <span>{solveError}</span>
        </div>
      )}
      {!solveError && plan?.what_changed && (
        <div className="infobox" role="status">
          <Leaf className="ic" aria-hidden="true" />
          <span>{plan.what_changed}</span>
        </div>
      )}

      {plan && uncoveredMsg && (
        <div className="infobox" role="status" style={{ flexDirection: "column", gap: 10 }}>
          <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
            <AlertCircle className="ic" aria-hidden="true" />
            <span>
              {uncoveredMsg}{" "}
              {capApplies && !household.use_more_snap
                ? `This trip is held to ${fmtMoney(plan.trip_snap_cap_cents)} so your SNAP lasts until ${fmtDate(household.deposit_date)}.`
                : "Add cash or pick different meals under Adjust to cover the rest."}
              {plan.relaxed.includes("variety") && Object.keys(plan.meals).length <= 3
                ? " At this budget only a few meals fit, so they repeat."
                : ""}
            </span>
          </div>
          {capApplies && !household.use_more_snap && (
            <button type="button" className="btn-line" onClick={() => setHousehold({ use_more_snap: true })}>
              Use more of my balance this trip
            </button>
          )}
        </div>
      )}

      {plan && staples.length > 0 && (
        <p className="basics">
          Basics you have: {staples.join(", ")}.{" "}
          <button type="button" className="link" onClick={() => navigate("/pantry")}>
            Out of one? Update Pantry
          </button>
        </p>
      )}

      <TodayRow day={plan?.schedule[0]} meals={meals} loading={solving} onOpen={setOpenMeal} />

      {plan && chosen.length > 0 && (
        <section aria-label="Meals this trip">
          <h3 className="section-title section-title--sm">Your meals this trip ({chosen.length})</h3>
          {chosen.map(({ meal, times }) => (
            <MealCard
              key={meal.id}
              meal={meal}
              times={times}
              servingCents={plan.meal_serving_cents[meal.id]}
              badge={null}
              onOpen={() => setOpenMeal(meal)}
              loading={solving}
            />
          ))}
        </section>
      )}

      {plan && <WeekView schedule={plan.schedule} meals={meals} onNotForMe={notForMe} loading={solving} />}

      <div className="cta-pinned" style={{ marginTop: 8 }}>
        <button type="button" className="btn-primary" onClick={() => navigate("/list")} disabled={!plan}>
          <ShoppingBasket className="ic" aria-hidden="true" />
          See shopping list
        </button>
      </div>
      <p className="disclaim center" style={{ marginTop: 12 }}>
        Entered manually — not connected to your EBT account.{plan ? ` · ${plan.solve_ms} ms` : ""}
      </p>

      <MealDetail
        meal={openMeal}
        ingredients={ingredients}
        servingCents={openMeal ? plan?.meal_serving_cents[openMeal.id] : undefined}
        times={openMeal ? plan?.meals[openMeal.id] : undefined}
        excluded={openMeal ? household.excluded_meals.includes(openMeal.id) : false}
        included={openMeal ? isIncluded(openMeal.id) : true}
        onClose={() => setOpenMeal(null)}
        onNotForMe={notForMe}
        onUndoNotForMe={undoNotForMe}
        onToggleIncluded={toggleIncluded}
      />

      <AdjustSheet open={adjusting} onClose={() => setAdjusting(false)} title="Adjust this trip">
        <div className="seg" role="group" aria-label="How you'll pay" style={{ marginBottom: 0 }}>
          <button type="button" className={household.snap_only ? "" : "active"} onClick={() => setHousehold({ snap_only: false })}>
            SNAP + cash
          </button>
          <button type="button" className={household.snap_only ? "active" : ""} onClick={() => setHousehold({ snap_only: true, cash_cents: 0 })}>
            SNAP only
          </button>
        </div>
        <PlanForm
          household={household}
          onSave={(patch) => {
            setHousehold(patch);
            setAdjusting(false);
          }}
        />
        {capApplies && (
          <label className="checkrow">
            <input type="checkbox" checked={household.use_more_snap} onChange={(e) => setHousehold({ use_more_snap: e.target.checked })} />
            <span className="grow">
              Use more of my balance this trip
              <br />
              <span className="subnote">
                {plan
                  ? household.use_more_snap
                    ? `This leaves ${fmtMoney(plan.snap_remaining_after_cents)} for the remaining ${plural(plan.days_remaining_after, "day")}.`
                    : `Held to ${fmtMoney(plan.trip_snap_cap_cents)} this trip so your SNAP lasts until ${fmtDate(household.deposit_date)}.`
                  : ""}
              </span>
            </span>
          </label>
        )}
        {plan && <PaymentCard plan={plan} household={household} loading={solving} />}
        {plan && (
          <div>
            <h3 className="section-title section-title--sm">Nutrition this trip</h3>
            <NutritionStrip plan={plan} />
          </div>
        )}
        <MealDrawer
          meals={meals}
          ingredients={ingredients}
          household={household}
          plan={plan}
          error={solveError}
          onChangeAccepted={(ids) => setHousehold({ accepted_meals: ids })}
          onUndoNotForMe={undoNotForMe}
          onNotForMe={notForMe}
        />
        <div className="center">
          <button type="button" className="link" onClick={resetHousehold}>
            Redo setup
          </button>
        </div>
      </AdjustSheet>
    </div>
  );
}
