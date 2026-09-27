import { useEffect } from "react";
import { ThumbsDown, X } from "lucide-react";
import { fmtMoney } from "../format";
import type { Ingredient, Meal } from "../types";
import MealPhoto from "./MealPhoto";

/** Full-detail bottom sheet for one meal: photo, description, ingredients with SNAP/Card tags, and the accept/reject actions. */
export default function MealDetail({
  meal,
  ingredients,
  servingCents,
  times,
  excluded,
  included,
  onClose,
  onNotForMe,
  onUndoNotForMe,
  onToggleIncluded,
}: {
  meal: Meal | null;
  ingredients: Record<string, Ingredient>;
  servingCents?: number;
  times?: number;
  excluded: boolean;
  included: boolean;
  onClose: () => void;
  onNotForMe: (id: string) => void;
  onUndoNotForMe: (id: string) => void;
  onToggleIncluded?: (id: string) => void;
}) {
  const open = meal !== null;
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!meal) return null;

  const hasCost = typeof servingCents === "number";
  const equipment = meal.equipment.length ? meal.equipment.join(", ") : "no cooking";
  const status =
    times !== undefined && times > 0
      ? `In your plan: cooked ${times}× this trip`
      : excluded
        ? "Marked not for me"
        : !included
          ? "Not in this trip's plan"
          : "Available for this trip, not chosen by the planner";

  return (
    <div className="sheet sheet--top" role="dialog" aria-modal="true" aria-label={meal.name}>
      <div className="sheet__backdrop" onClick={onClose} />
      <div className="sheet__panel stack meal-detail">
        <div className="sheet__handle" />

        <div className="meal-detail__hero">
          <MealPhoto meal={meal} variant="hero" />
          <button type="button" className="iconbtn meal-detail__close" aria-label="Close" onClick={onClose}>
            <X className="ic" aria-hidden="true" />
          </button>
        </div>

        <div>
          <h2>{meal.name}</h2>
          {meal.description && <p className="meal-detail__desc">{meal.description}</p>}
        </div>

        <div className="meal-detail__meta">
          <span className="tag mute">{meal.prep_min} min</span>
          <span className="tag mute">serves {meal.servings}</span>
          <span className="tag mute">{equipment}</span>
          {hasCost && <span className="tag cost">{fmtMoney(servingCents)} per serving</span>}
        </div>

        <p className="meal-detail__status">{status}</p>

        <section>
          <h3 className="section-title section-title--sm meal-detail__title">Ingredients</h3>
          <ul className="meal-ings">
            {Object.entries(meal.ingredients).map(([id, grams]) => {
              const ing = ingredients[id];
              const sub = ing?.kroger_product ? `${ing.kroger_product} · ${grams} g per batch` : `${grams} g per batch`;
              return (
                <li key={id} className="meal-ing">
                  <span className="meal-ing__text">
                    <span className="meal-ing__name">{ing?.name ?? id}</span>
                    <span className="subnote">{sub}</span>
                  </span>
                  <span className="meal-ing__tags">
                    {ing?.staple && <span className="tag mute">basic</span>}
                    {ing?.ebt_eligible ? <span className="tag elig">SNAP</span> : <span className="tag unv">Card</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="meal-detail__actions">
          {excluded ? (
            <button type="button" className="btn-line" onClick={() => onUndoNotForMe(meal.id)}>
              Add back
            </button>
          ) : (
            <button
              type="button"
              className="btn-line"
              onClick={() => {
                onNotForMe(meal.id);
                onClose();
              }}
            >
              <ThumbsDown className="ic" aria-hidden="true" />
              Not for me
            </button>
          )}
          {onToggleIncluded && !excluded && (
            <button type="button" className="btn-line" onClick={() => onToggleIncluded(meal.id)}>
              {included ? "Skip this trip" : "Include this trip"}
            </button>
          )}
        </div>

        <div>
          <p className="disclaim">Photo is an AI illustration of the dish, not the exact result.</p>
          {hasCost && (
            <p className="disclaim">
              Cost per serving is pro-rated by weight from Kroger package prices. Packages are bought whole, so the basket total can differ.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
