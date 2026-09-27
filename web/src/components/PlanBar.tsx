import { fmtMoney } from "../format";
import { useApp } from "../state";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Sticky one-line summary of the current plan above the tab bar; the whole bar opens /plan. Null until a plan exists. */
export default function PlanBar() {
  const { plan, solving, navigate } = useApp();
  if (!plan) return null;
  const n = Object.keys(plan.meals).length;

  return (
    <button
      type="button"
      className={`planbar${solving ? " loading" : ""}`}
      onClick={() => navigate("/plan")}
      aria-label="View plan"
    >
      <span className="planbar__text">
        {plural(n, "meal")} · {fmtMoney(plan.basket_cents)} · {plan.eligible_pct}% SNAP-eligible
      </span>
      <span className="planbar__cta" aria-hidden="true">View plan ›</span>
    </button>
  );
}
