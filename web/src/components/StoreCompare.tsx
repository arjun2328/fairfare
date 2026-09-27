import { Check, Store } from "lucide-react";
import { fmtMoney } from "../format";
import { useApp } from "../state";

/** Same household, same rules, one solve per store we hold real prices for. Tap a store to plan with its prices. */
export default function StoreCompare() {
  const { household, plan, stores, storePlans, comparing, compareStores, setHousehold } = useApp();
  if (!household || !plan || stores.length < 2) return null;

  const current = stores.find((s) => s.id === household.store) ?? stores[0];
  const compared = Object.keys(storePlans).length > 0;

  return (
    <section className="plancard storecmp" aria-label="Compare stores">
      <div className="row row--between" style={{ alignItems: "flex-start", gap: 12 }}>
        <div className="grow">
          <h3 className="section-title section-title--sm" style={{ marginBottom: 2 }}>
            <Store className="ic" aria-hidden="true" style={{ verticalAlign: "-4px", marginRight: 6 }} />
            Prices from {current.name}
          </h3>
          <p className="subnote">Online listing prices, so your store may differ a little.</p>
        </div>
        {!compared && (
          <button type="button" className="btn-line storecmp__btn" disabled={comparing} onClick={() => void compareStores()}>
            {comparing ? "Comparing…" : "Compare stores"}
          </button>
        )}
      </div>

      {compared && (
        <div className="storecmp__rows">
          {stores.map((s) => {
            const p = storePlans[s.id];
            const active = s.id === household.store;
            return (
              <button
                key={s.id}
                type="button"
                className={`storecmp__row${active ? " active" : ""}`}
                onClick={() => !active && setHousehold({ store: s.id })}
                aria-pressed={active}
              >
                <span className="storecmp__name">
                  {s.name}
                  <span className="subnote">
                    {s.priced} of {s.total} items priced
                    {p && Object.keys(p.uncovered).length > 0 ? " · some meals uncovered" : ""}
                  </span>
                </span>
                <span className="storecmp__total">
                  {p ? <b>{fmtMoney(p.basket_cents)}</b> : <span className="subnote">no plan</span>}
                  {active && <Check className="ic" aria-hidden="true" />}
                </span>
              </button>
            );
          })}
          <p className="disclaim" style={{ marginTop: 6 }}>
            Each total is the same household solved with that store's prices. Items a store does not list are left out
            of its plan, never guessed.
          </p>
        </div>
      )}
    </section>
  );
}
