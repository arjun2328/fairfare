import { Check, Plus, X } from "lucide-react";
import { fmtMoney } from "../format";
import type { Meal } from "../types";
import MealPhoto from "./MealPhoto";

export type MealBadge = "in" | "out" | "muted";

const BADGE: Record<MealBadge, { Icon: typeof Check; label: string }> = {
  in: { Icon: Check, label: "In your plan, tap to skip" },
  out: { Icon: Plus, label: "Not in your plan, tap to add" },
  muted: { Icon: X, label: "Marked not for me" },
};

/** Photo-left row card. The card opens the meal; the round badge over the photo toggles it in or out of the plan. */
export default function MealCard({
  meal,
  servingCents,
  times,
  badge,
  onOpen,
  onBadge,
  loading,
}: {
  meal: Meal;
  servingCents?: number;
  times?: number;
  badge?: MealBadge | null;
  onOpen: () => void;
  onBadge?: () => void;
  loading?: boolean;
}) {
  const b = badge ? BADGE[badge] : null;
  const BadgeIcon = b?.Icon;

  return (
    <div className={`meal-card${loading ? " loading" : ""}`}>
      <button type="button" className="meal-card__body" onClick={onOpen}>
        <MealPhoto meal={meal} variant="card" />
        <span className="meal-card__text">
          <span className="meal-card__name">{meal.name}</span>
          {meal.description && <span className="subnote meal-card__desc">{meal.description}</span>}
          <span className="meal-card__tags">
            <span className="tag mute">{meal.prep_min} min</span>
            <span className="tag mute">serves {meal.servings}</span>
            {typeof servingCents === "number" && <span className="tag cost">{fmtMoney(servingCents)}/serving</span>}
            {times !== undefined && times > 0 && <span className="tag nutri">{times}× this trip</span>}
          </span>
        </span>
      </button>

      {b && BadgeIcon && (onBadge ? (
        <button
          type="button"
          className={`meal-badge meal-badge--${badge}`}
          aria-label={b.label}
          onClick={(e) => {
            e.stopPropagation();
            onBadge();
          }}
        >
          <span className="meal-badge__dot">
            <BadgeIcon className="ic" aria-hidden="true" />
          </span>
        </button>
      ) : (
        <span className={`meal-badge meal-badge--${badge}`} role="img" aria-label={b.label}>
          <span className="meal-badge__dot">
            <BadgeIcon className="ic" aria-hidden="true" />
          </span>
        </span>
      ))}
    </div>
  );
}
