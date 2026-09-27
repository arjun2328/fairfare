import { Leaf, ShoppingBasket } from "lucide-react";
import { useApp } from "../state";

/** The two labelled shortcuts every main screen carries top-right: Profile and the Shopping list. */
export default function TopActions() {
  const { plan, navigate } = useApp();
  return (
    <div className="topactions">
      <button type="button" className="adjust-btn" onClick={() => navigate("/profile")}>
        <Leaf className="ic" aria-hidden="true" />
        Profile
      </button>
      <button
        type="button"
        className="adjust-btn adjust-btn--primary"
        disabled={!plan}
        title={plan ? "Open your shopping list" : "Your plan is still loading"}
        onClick={() => navigate("/list")}
      >
        <ShoppingBasket className="ic" aria-hidden="true" />
        Shopping list
      </button>
    </div>
  );
}
