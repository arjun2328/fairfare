import { useEffect, type ReactNode } from "react";
import { Check, Leaf, ThumbsDown, X } from "lucide-react";
import { fmtMoney } from "../format";
import type { Ingredient, Meal, MealFacts } from "../types";
import MealPhoto from "./MealPhoto";

/** "Rice", "Rice and beans", "Rice, beans and eggs". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Recipe-detail bottom sheet: photo, per-serving facts, SNAP note, add/skip/pin actions, ingredients with SNAP/Card tags. */
export default function MealDetail({
  meal,
  ingredients,
  facts,
  times,
  excluded,
  included,
  pinned,
  onClose,
  onNotForMe,
  onUndoNotForMe,
  onSkip,
  onInclude,
  onPin,
  onUnpin,
}: {
  meal: Meal | null;
  ingredients: Record<string, Ingredient>;
  facts?: MealFacts;
  times?: number;
  excluded: boolean;
  included: boolean;
  pinned: boolean;
  onClose: () => void;
  onNotForMe: (id: string) => void;
  onUndoNotForMe: (id: string) => void;
  onSkip: (id: string) => void;
  onInclude: (id: string) => void;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
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

  const inTrip = times !== undefined && times > 0;
  const meta = facts
    ? `${meal.prep_min} min · ${fmtMoney(facts.serving_cents)} / serving · ${meal.servings} servings`
    : `${meal.prep_min} min · ${meal.servings} servings`;
  const cashNames = facts ? joinNames(facts.cash_ingredients.map((id) => ingredients[id]?.name ?? id)) : "";

  let action: ReactNode;
  if (inTrip) {
    action = (
      <button type="button" className="btn-line on" onClick={() => onSkip(meal.id)}>
        Added to this trip
        <Check className="ic" aria-hidden="true" />
      </button>
    );
  } else if (pinned) {
    action = (
      <button type="button" className="btn-line on" onClick={() => onUnpin(meal.id)}>
        Pinned · didn't fit this trip
      </button>
    );
  } else if (excluded) {
    action = (
      <button type="button" className="btn-line" onClick={() => onUndoNotForMe(meal.id)}>
        Add back
      </button>
    );
  } else if (!included) {
    action = (
      <button type="button" className="btn-line" onClick={() => onInclude(meal.id)}>
        Include this trip
      </button>
    );
  } else {
    action = (
      <button type="button" className="btn-primary" onClick={() => onPin(meal.id)}>
        Add to this trip
      </button>
    );
  }

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
          <p className="meal-detail__metaline">{meta}</p>
        </div>

        {facts && (
          <>
            <div className="nutri-row" aria-label="Per serving">
              <div className="nstat">
                <b>{Math.round(facts.kcal)}</b>
                <span>calories</span>
              </div>
              <div className="nstat">
                <b>{Math.round(facts.protein_g)}g</b>
                <span>protein</span>
              </div>
              <div className="nstat">
                <b>{Math.round(facts.fiber_g)}g</b>
                <span>fiber</span>
              </div>
              <div className="nstat">
                <b>{Math.round(facts.sodium_mg)}mg</b>
                <span>sodium</span>
              </div>
            </div>
            <p className="subnote meal-detail__pernote">per serving</p>

            <div className="infobox" role="note">
              <Leaf className="ic" aria-hidden="true" />
              <span className="infobox__text">
                {facts.snap_eligible ? (
                  <>
                    <b>All SNAP-eligible</b>
                    <span>Every ingredient here can go on your EBT card.</span>
                  </>
                ) : (
                  <>
                    <b>Needs some cash</b>
                    <span>{cashNames} must be paid with cash or card.</span>
                  </>
                )}
              </span>
            </div>
          </>
        )}

        <div className="meal-detail__actions">
          {action}
          {!excluded && (
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                onNotForMe(meal.id);
                onClose();
              }}
            >
              <ThumbsDown className="ic" aria-hidden="true" />
              Not for me
            </button>
          )}
        </div>

        <section>
          <h3 className="section-title section-title--sm meal-detail__title">Ingredients</h3>
          <ul className="meal-ings">
            {Object.keys(meal.ingredients).map((id) => {
              const ing = ingredients[id];
              const sub = ing ? `${ing.kroger_product} · ${ing.aisle} aisle` : null;
              return (
                <li key={id} className="meal-ing">
                  <span className="meal-ing__text">
                    <span className="meal-ing__name">{ing?.name ?? id}</span>
                    {sub && <span className="subnote">{sub}</span>}
                  </span>
                  <span className="meal-ing__tags">
                    {ing?.staple && <span className="tag mute">basic</span>}
                    {ing && (ing.ebt_eligible ? <span className="tag elig">SNAP eligible</span> : <span className="tag unv">Card only</span>)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div>
          <p className="disclaim">Photo is an AI illustration of the dish, not the exact result.</p>
          {facts && (
            <p className="disclaim">
              Cost per serving is pro-rated by weight from Kroger package prices. Packages are bought whole, so the basket total can differ.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
