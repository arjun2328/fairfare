import { AlertCircle } from "lucide-react";
import { fmtMoney } from "../format";
import type { Household, Plan } from "../types";

/** Payment summary in the FairFare row style. Every number comes from the Plan; nothing is computed here. */
export default function PaymentCard({
  plan,
  household,
  loading,
  title = "Payment summary",
}: {
  plan: Plan;
  household: Household;
  loading?: boolean;
  title?: string | null;
}) {
  let warning: string | null = null;
  if (household.snap_only && plan.cash_cents > 0) {
    warning = `This trip needs ${fmtMoney(plan.cash_cents)} in cash and you're set to SNAP only. Swap or remove an item to close the gap.`;
  } else if (plan.cash_remaining_cents < 0) {
    warning = `This is ${fmtMoney(-plan.cash_remaining_cents)} over your available cash.`;
  }
  return (
    <section className={`plancard${loading ? " loading" : ""}`} aria-label="Payment summary">
      {title && <h3 className="section-title section-title--sm">{title}</h3>}
      <div className="payrow total">
        <span>Grocery basket</span>
        <b>{fmtMoney(plan.basket_cents)}</b>
      </div>
      <div className="payrow">
        <span>Planned SNAP payment</span>
        <span>{fmtMoney(plan.ebt_cents)}</span>
      </div>
      <div className="payrow">
        <span>Cash you'll need</span>
        <span>{fmtMoney(plan.cash_cents)}</span>
      </div>
      <div className="payrow">
        <span>Cash remaining</span>
        <span>{fmtMoney(plan.cash_remaining_cents)}</span>
      </div>
      <div className="payrow quiet">
        <span>SNAP-eligible items</span>
        <span>{plan.eligible_pct}%</span>
      </div>
      {warning && (
        <div className="warnbox" role="status">
          <AlertCircle className="ic" aria-hidden="true" />
          <span>{warning}</span>
        </div>
      )}
      <p className="disclaim">Entered manually — not connected to your EBT account.</p>
    </section>
  );
}
