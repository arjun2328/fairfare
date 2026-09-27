import { useEffect, useState } from "react";
import { AlertCircle, Leaf, Pencil, UtensilsCrossed } from "lucide-react";
import { daysUntil, fmtDate, fmtMoney } from "../format";
import { useApp } from "../state";
import type { Household, NutrientTargets, Plan as PlanT } from "../types";
import PaymentCard from "../components/PaymentCard";
import MealDrawer from "../components/MealDrawer";

const NUTRIENTS: { key: string; label: string; target: keyof NutrientTargets; kind: "min" | "max" }[] = [
  { key: "kcal", label: "calories", target: "kcal_min", kind: "min" },
  { key: "protein", label: "protein", target: "protein_g_min", kind: "min" },
  { key: "fiber", label: "fiber", target: "fiber_g_min", kind: "min" },
  { key: "sodium", label: "sodium", target: "sodium_mg_max", kind: "max" },
  { key: "sugar", label: "sugar", target: "sugar_g_max", kind: "max" },
];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Dollars typed by the user -> integer cents. The only arithmetic on this screen. */
function toCents(dollars: string): number {
  const n = Number(dollars);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

function PlanForm({ household, onSave, onClose }: { household: Household; onSave: (p: Partial<Household>) => void; onClose: () => void }) {
  const [snap, setSnap] = useState(String(household.ebt_cents / 100));
  const [cash, setCash] = useState(String(household.cash_cents / 100));
  const [date, setDate] = useState(household.deposit_date ?? "");
  const [days, setDays] = useState(household.trip_days);
  const [people, setPeople] = useState(household.people);
  const [prep, setPrep] = useState(household.max_prep_min);

  const save = () => {
    onSave({
      ebt_cents: toCents(snap),
      cash_cents: household.snap_only ? 0 : toCents(cash),
      deposit_date: date || null,
      trip_days: days,
      people,
      max_prep_min: prep,
    });
    onClose();
  };

  return (
    <div>
      <div className="planform">
        <div>
          <label htmlFor="pf-snap">SNAP balance for this trip</label>
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
        Save plan
      </button>
      <p className="disclaim">Entered manually — not connected to your EBT account.</p>
    </div>
  );
}

function NutritionStrip({ plan }: { plan: PlanT }) {
  return (
    <div className="nutri-row" aria-label="Nutrition this trip">
      {NUTRIENTS.map(({ key, label, target, kind }) => {
        const short = plan.shortfalls[key] ?? 0;
        const goal = plan.targets[target];
        let value = "met";
        if (short > 0 && goal > 0) {
          const pct = Math.round((100 * (plan.nutrition[key] ?? 0)) / goal);
          value = kind === "min" ? `${pct}%` : `${pct}%`;
        }
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
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [household?.snap_only]);
  if (!household) return null;

  const days = daysUntil(household.deposit_date);
  const notForMe = (id: string) => setHousehold({ excluded_meals: Array.from(new Set([...household.excluded_meals, id])) });
  const undoNotForMe = (id: string) => setHousehold({ excluded_meals: household.excluded_meals.filter((x) => x !== id) });
  const chosen = plan ? Object.entries(plan.meals) : [];
  const pct = plan?.eligible_pct ?? 0;

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="eyebrow">
            {greeting()} <span className="pill">{household.snap_only ? "SNAP only" : "SNAP + cash"}</span>
          </div>
          <h2>Ready to shop?</h2>
        </div>
      </div>

      <button type="button" className={`budget-card${solving ? " loading" : ""}`} onClick={() => navigate("/list")} aria-label="View your shopping list">
        <div className="ring" style={{ background: `conic-gradient(var(--gold) 0% ${pct}%, rgba(255,255,255,.18) ${pct}% 100%)` }}>
          <span>{plan ? `${pct}%` : "…"}</span>
        </div>
        <div className="grow">
          <div className="label">Cash you'll need this trip</div>
          <div className="amt">{plan ? fmtMoney(plan.cash_cents) : solveError ? "No plan yet" : "Planning…"}</div>
          <div className="sub">
            {plan
              ? `Covers you until ${fmtDate(plan.covers_until)} · SNAP covers about ${plan.trips_covered} trips like this`
              : solveError
                ? "Tap the pencil below to change the setup, then we'll try again."
                : "Working it out from real store prices"}
          </div>
        </div>
        <span className="link-quiet">View list ›</span>
      </button>

      {solveError && (
        <div className="warnbox" role="alert" style={{ marginBottom: 18 }}>
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

      <section className="plancard" aria-label="Your plan">
        <div className="plantop">
          <div>
            <div className="big">{days !== null && days >= 0 ? `${days} day${days === 1 ? "" : "s"}` : `${household.trip_days} days`}</div>
            <div className="sub">{days !== null && days >= 0 ? "until your deposit" : "this trip covers"}</div>
          </div>
          <div>
            <div className="big">{fmtMoney(household.ebt_cents)}</div>
            <div className="sub">SNAP available</div>
          </div>
          <button type="button" className="iconbtn" aria-label="Edit plan" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
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
        {editing && <PlanForm household={household} onSave={setHousehold} onClose={() => setEditing(false)} />}
        {!editing && <p className="disclaim">Balances are entered manually — not connected to your EBT account.</p>}
      </section>

      {plan && <PaymentCard plan={plan} household={household} loading={solving} />}

      {plan && (
        <>
          <h3 className="section-title section-title--sm">Nutrition this trip</h3>
          <NutritionStrip plan={plan} />
        </>
      )}

      <h3 className="section-title section-title--sm">Your meals ({chosen.length})</h3>
      <div className={solving ? "loading" : ""}>
        {chosen.length === 0 && <p className="disclaim">No meals yet. Planning your trip…</p>}
        {chosen.map(([id, times]) => {
          const m = meals[id];
          return (
            <div key={id} className="weekitem">
              <span className="name">
                {m?.name ?? id}
                <br />
                <span className="subnote">
                  {m ? `${m.slot} · ${m.prep_min} min · makes ${m.servings}` : ""}
                </span>
              </span>
              <span className="tag nutri">{times}×</span>
              <button type="button" className="rm" aria-label={`Not for me: ${m?.name ?? id}`} title="Not for me" onClick={() => notForMe(id)}>
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <MealDrawer
          meals={meals}
          ingredients={ingredients}
          household={household}
          error={solveError}
          onChangeAccepted={(ids) => setHousehold({ accepted_meals: ids })}
          onUndoNotForMe={undoNotForMe}
        />
      </div>

      <button type="button" className="btn-primary" style={{ marginTop: 18 }} onClick={() => navigate("/list")} disabled={!plan}>
        <UtensilsCrossed className="ic" aria-hidden="true" />
        See your shopping list
      </button>

      <div className="center" style={{ marginTop: 16 }}>
        {plan && <p className="tiny muted">{plan.solve_ms} ms</p>}
        <button type="button" className="link" onClick={resetHousehold}>
          Redo setup
        </button>
      </div>
    </div>
  );
}
