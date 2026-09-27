import { useState } from "react";
import { AlertCircle, Leaf, Pencil, ShoppingBasket } from "lucide-react";
import { daysUntil, fmtDate, fmtMoney } from "../format";
import { useApp } from "../state";
import type { Household, Meal, Plan as PlanT, Slot } from "../types";
import PaymentCard, { uncoveredSentence } from "../components/PaymentCard";
import PlanForm, { NutritionStrip } from "../components/PlanForm";
import MealDrawer from "../components/MealDrawer";
import MealDetail from "../components/MealDetail";
import MealPhoto from "../components/MealPhoto";
import TodayRow from "../components/TodayRow";
import WeekView from "../components/WeekView";
import AdjustSheet from "../components/AdjustSheet";

const SLOT_ORDER: Record<Slot, number> = { breakfast: 0, lunch: 1, dinner: 2 };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Pace line under the payment toggle: against the deposit when a date is set, otherwise the coverage window. */
function paceLine(plan: PlanT, household: Household): { text: string; warn: boolean } {
  const covers = `Covers ${plural(household.trip_days, "day")}`;
  if (!household.deposit_date) return { text: `${covers} · until ${fmtDate(plan.covers_until)}`, warn: false };
  if (plan.on_pace) return { text: `${covers} · on pace to ${fmtDate(household.deposit_date)}`, warn: false };
  const runOut = plan.projected_run_out_date ? `runs out ${fmtDate(plan.projected_run_out_date)}` : "runs out before your deposit";
  return { text: `${covers} · SNAP ${runOut}, ahead of your ${fmtDate(household.deposit_date)} deposit`, warn: true };
}

export default function Plan() {
  const {
    household,
    plan,
    meals,
    ingredients,
    facts,
    solving,
    solveError,
    setHousehold,
    resetHousehold,
    navigate,
    pinMeal,
    unpinMeal,
    skipMeal,
    includeMeal,
  } = useApp();
  const [adjusting, setAdjusting] = useState(false);
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  if (!household) return null;

  const notForMe = (id: string) => setHousehold({ excluded_meals: Array.from(new Set([...household.excluded_meals, id])) });
  const undoNotForMe = (id: string) => setHousehold({ excluded_meals: household.excluded_meals.filter((x) => x !== id) });
  const isIncluded = (id: string) => household.accepted_meals === null || household.accepted_meals.includes(id);
  const isPinned = (id: string) => (household.required_meals ?? []).includes(id);

  const days = daysUntil(household.deposit_date);
  const capApplies = days !== null && days > household.trip_days; // the solver paces SNAP across the deposit gap
  const showDeposit = days !== null && days >= 0;
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
        <h2>This trip's plan</h2>
        <button type="button" className="iconbtn iconbtn--gold" aria-label="Profile" onClick={() => navigate("/profile")}>
          <Leaf className="ic" aria-hidden="true" />
        </button>
      </div>

      <section className={`plancard${solving ? " loading" : ""}`} aria-label="This trip">
        <div className="plantop">
          <div>
            <div className="big">{showDeposit ? plural(days, "day") : plural(household.trip_days, "day")}</div>
            <div className="sub">{showDeposit ? "until your next deposit" : "this trip covers"}</div>
          </div>
          <button type="button" className="iconbtn" aria-label="Adjust this trip" aria-haspopup="dialog" onClick={() => setAdjusting(true)}>
            <Pencil className="ic" aria-hidden="true" />
          </button>
        </div>
        <div className="seg" role="group" aria-label="How you'll pay">
          <button type="button" className={household.snap_only ? "" : "active"} onClick={() => setHousehold({ snap_only: false })}>
            SNAP + cash
          </button>
          <button type="button" className={household.snap_only ? "active" : ""} onClick={() => setHousehold({ snap_only: true, cash_cents: 0 })}>
            SNAP only
          </button>
        </div>
        {plan && pace ? (
          <p className={`subnote pace-line${pace.warn ? " warn" : ""}`} role={pace.warn ? "status" : undefined}>
            {pace.warn && <AlertCircle className="ic" aria-hidden="true" />}
            <span>{pace.text}</span>
          </p>
        ) : (
          <p className="subnote pace-line">
            <span>{solveError ? "Tap the pencil to change the setup, then we'll try again." : "Working it out from real store prices"}</span>
          </p>
        )}
      </section>

      {plan && <PaymentCard plan={plan} household={household} loading={solving} title="Payment summary" />}

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

      {plan && chosen.length > 0 && (
        <section className={`triplist${solving ? " loading" : ""}`} aria-label="Meals this trip">
          <h3 className="section-title section-title--sm">Your trip ({plural(chosen.length, "meal")})</h3>
          {chosen.map(({ meal, times }) => {
            const cost = plan.meal_cost_cents?.[meal.id];
            return (
              <div key={meal.id} className="weekitem">
                <button type="button" className="weekitem__open" onClick={() => setOpenMeal(meal)}>
                  <MealPhoto meal={meal} variant="thumb" />
                  <span className="weekitem__text">
                    <span className="name">{meal.name}</span>
                    <span className="subnote">
                      {times}× · {meal.prep_min} min
                    </span>
                  </span>
                </button>
                {typeof cost === "number" && <span className="tag cost">about {fmtMoney(cost)}</span>}
                <button type="button" className="rm" aria-label={`Not for me: ${meal.name}`} title="Not for me" onClick={() => notForMe(meal.id)}>
                  ×
                </button>
              </div>
            );
          })}
        </section>
      )}

      <TodayRow day={plan?.schedule[0]} meals={meals} loading={solving} onOpen={setOpenMeal} />

      {plan && <WeekView schedule={plan.schedule} meals={meals} onNotForMe={notForMe} onOpen={setOpenMeal} loading={solving} />}

      {plan && staples.length > 0 && (
        <p className="basics">
          Basics you have: {staples.join(", ")}.{" "}
          <button type="button" className="link" onClick={() => navigate("/pantry")}>
            Out of one? Update Pantry
          </button>
        </p>
      )}

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
        facts={openMeal ? facts[openMeal.id] : undefined}
        times={openMeal ? plan?.meals[openMeal.id] : undefined}
        excluded={openMeal ? household.excluded_meals.includes(openMeal.id) : false}
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

      <AdjustSheet open={adjusting} onClose={() => setAdjusting(false)} title="Adjust this trip">
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
          facts={facts}
          error={solveError}
          onChangeAccepted={(ids) => setHousehold({ accepted_meals: ids })}
          onUndoNotForMe={undoNotForMe}
          onNotForMe={notForMe}
          onPin={pinMeal}
          onUnpin={unpinMeal}
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
