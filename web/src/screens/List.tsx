import { useMemo, useState } from "react";
import PaymentCard from "../components/PaymentCard";
import CartGroup from "../components/CartGroup";
import { useApp } from "../state";
import { fmtMoney } from "../format";
import type { PlanItem } from "../types";

const AISLE_ORDER = ["produce", "dairy", "meat", "frozen", "dry", "canned", "bakery", "other"];

/**
 * The one place in the frontend (besides the running total below) allowed to add money: sums
 * line_cents of the checked cart rows, split EBT vs. cash. Local UI state only, never persisted.
 */
function basketTotals(cart: PlanItem[], checkedIds: Set<string>): { ebt: number; cash: number } {
  let ebt = 0;
  let cash = 0;
  for (const item of cart) {
    if (!checkedIds.has(item.ingredient_id)) continue;
    if (item.ebt_eligible) ebt += item.line_cents;
    else cash += item.line_cents;
  }
  return { ebt, cash };
}

export default function List() {
  const { plan, prevPlan, household, ingredients, meals, solving, setHousehold, navigate } = useApp();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleOutOfStock = (id: string) => {
    if (!household) return;
    const current = household.out_of_stock;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setHousehold({ out_of_stock: next });
  };

  const groups = useMemo(() => {
    const g: Record<string, PlanItem[]> = {};
    for (const item of plan?.cart ?? []) {
      (g[item.aisle] ??= []).push(item);
    }
    return g;
  }, [plan]);

  const swappedIn = useMemo(() => {
    if (!plan || !prevPlan) return new Set<string>();
    const prevIds = new Set(prevPlan.cart.map((i) => i.ingredient_id));
    return new Set(plan.cart.filter((i) => !prevIds.has(i.ingredient_id)).map((i) => i.ingredient_id));
  }, [plan, prevPlan]);

  if (!plan || !household) {
    return (
      <div className="screen">
        <p className="muted">No plan yet.</p>
        <button type="button" className="link" onClick={() => navigate("/plan")}>
          Go to Plan
        </button>
      </div>
    );
  }

  const { ebt, cash } = basketTotals(plan.cart, checkedIds);
  const aisleKeys = [...AISLE_ORDER, ...Object.keys(groups).filter((a) => !AISLE_ORDER.includes(a))];
  const pantryEntries = Object.entries(plan.from_pantry);
  const planMealIds = Object.keys(plan.meals);

  return (
    <div className="screen">
      <div className="topbar">
        <h2>Shopping list</h2>
      </div>

      <PaymentCard plan={plan} household={household} loading={solving} />
      <p className="disclaim">SNAP can't cover delivery fees or tips if you order for delivery.</p>

      <div
        className="card-div"
        style={{ position: "sticky", top: 0, zIndex: 5, justifyContent: "space-between", fontWeight: 600, fontSize: 14 }}
      >
        <span>In basket</span>
        <span>
          EBT {fmtMoney(ebt)} · Card {fmtMoney(cash)}
        </span>
      </div>

      {aisleKeys.map((aisle) => (
        <CartGroup
          key={aisle}
          aisle={aisle}
          items={groups[aisle] ?? []}
          ingredients={ingredients}
          checkedIds={checkedIds}
          onToggleChecked={toggleChecked}
          outOfStock={household.out_of_stock}
          onToggleOutOfStock={toggleOutOfStock}
          swappedIn={swappedIn}
          meals={meals}
          planMealIds={planMealIds}
        />
      ))}

      {pantryEntries.length > 0 && (
        <section>
          <h3 className="section-title section-title--sm">From your kitchen</h3>
          {pantryEntries.map(([id, grams]) => (
            <div key={id} className="ing have">
              <div className="ing-top">
                <span className="dot" aria-hidden="true" />
                <span className="name">{ingredients[id]?.name ?? id}</span>
                <span className="subnote">estimated {grams} g</span>
              </div>
            </div>
          ))}
        </section>
      )}

      <button type="button" className="btn-primary" onClick={() => navigate("/register")}>
        Show the cashier
      </button>
    </div>
  );
}
