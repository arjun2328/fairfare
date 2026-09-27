import { useState } from "react";
import { ChevronRight, Leaf } from "lucide-react";
import { useApp } from "../state";
import type { Diet, Equipment } from "../types";
import AdjustSheet from "../components/AdjustSheet";
import PlanForm from "../components/PlanForm";

type Sheet = "balances" | "diet" | "kitchen" | "excluded";

const DIETS: { key: Diet; label: string; note?: string }[] = [
  { key: "vegetarian", label: "Vegetarian", note: "No meat, poultry, fish, shellfish or gelatin." },
  { key: "vegan", label: "Vegan", note: "Vegetarian, plus no dairy or eggs." },
  { key: "halal", label: "Halal", note: "No pork, alcohol or gelatin." },
  { key: "kosher", label: "Kosher", note: "No pork, shellfish or gelatin. Meat and dairy separation isn't modeled." },
];

const EQUIPMENT: { key: Equipment; label: string }[] = [
  { key: "stovetop", label: "Stovetop" },
  { key: "microwave", label: "Microwave" },
  { key: "oven", label: "Oven" },
];

const DISCLAIM = "Entered manually — not connected to your EBT account.";

function ProfileRow({ label, value, onClick }: { label: string; value?: string; onClick: () => void }) {
  return (
    <button type="button" className="profile-row" onClick={onClick}>
      <span className="profile-row__label">{label}</span>
      <span className="profile-row__value">
        {value && <span>{value}</span>}
        <ChevronRight className="ic" aria-hidden="true" />
      </span>
    </button>
  );
}

/** Household settings as a list of rows; each opens a sheet that patches the household (and re-solves). */
export default function Profile() {
  const { household, plan, meals, setHousehold, resetHousehold } = useApp();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  if (!household) return null;

  const close = () => setSheet(null);
  const dietValue = household.diet.length ? household.diet.join(", ") : "None";
  const kitchenValue = household.equipment.length ? household.equipment.join(" + ") : "No cooking";
  const excludedCount = household.excluded_meals.length;

  const toggleDiet = (d: Diet, on: boolean) => {
    const next = on ? Array.from(new Set([...household.diet, d])) : household.diet.filter((x) => x !== d);
    setHousehold({ diet: next });
  };
  const toggleEquipment = (e: Equipment, on: boolean) => {
    const next = on ? Array.from(new Set([...household.equipment, e])) : household.equipment.filter((x) => x !== e);
    setHousehold({ equipment: next });
  };
  const addBack = (id: string) => setHousehold({ excluded_meals: household.excluded_meals.filter((x) => x !== id) });

  return (
    <div className="screen">
      <div className="topbar">
        <h2>Profile</h2>
      </div>

      <div className="profile-head">
        <div className="profile-avatar" aria-hidden="true">
          <Leaf className="ic" />
        </div>
        <h3>Household of {household.people}</h3>
      </div>

      <div className="profile-list">
        <ProfileRow label="Retake setup quiz" onClick={resetHousehold} />
        <ProfileRow label="Deposit & balances" onClick={() => setSheet("balances")} />
        <ProfileRow label="Dietary needs" value={dietValue} onClick={() => setSheet("diet")} />
        <ProfileRow label="Kitchen setup" value={kitchenValue} onClick={() => setSheet("kitchen")} />
        <ProfileRow label="Meals marked not for me" value={String(excludedCount)} onClick={() => setSheet("excluded")} />
      </div>

      <div className="profile-foot">
        <p className="disclaim" style={{ marginTop: 0 }}>{DISCLAIM}</p>
        {plan && <p className="tiny muted">Planner answered in {plan.solve_ms} ms</p>}
      </div>

      <AdjustSheet open={sheet === "balances"} onClose={close} title="Deposit & balances">
        <PlanForm
          household={household}
          onSave={(patch) => {
            setHousehold(patch);
            close();
          }}
        />
      </AdjustSheet>

      <AdjustSheet open={sheet === "diet"} onClose={close} title="Dietary needs">
        <p className="sheet-note">Simplified rules: each choice removes the matching ingredients from every meal.</p>
        <div>
          {DIETS.map(({ key, label, note }) => (
            <label key={key} className="checkrow">
              <input type="checkbox" checked={household.diet.includes(key)} onChange={(e) => toggleDiet(key, e.target.checked)} />
              <span className="grow">
                {label}
                {note && (
                  <>
                    <br />
                    <span className="subnote">{note}</span>
                  </>
                )}
              </span>
            </label>
          ))}
        </div>
        <button type="button" className="btn-primary" onClick={close}>
          Done
        </button>
      </AdjustSheet>

      <AdjustSheet open={sheet === "kitchen"} onClose={close} title="Kitchen setup">
        <div>
          {EQUIPMENT.map(({ key, label }) => (
            <label key={key} className="checkrow">
              <input type="checkbox" checked={household.equipment.includes(key)} onChange={(e) => toggleEquipment(key, e.target.checked)} />
              <span className="grow">{label}</span>
            </label>
          ))}
        </div>
        <div className="planform">
          <div>
            <label htmlFor="profile-prep">Most minutes you'll spend cooking a meal</label>
            <select id="profile-prep" value={household.max_prep_min} onChange={(e) => setHousehold({ max_prep_min: Number(e.target.value) })}>
              {[15, 30, 45, 60].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={close}>
          Done
        </button>
      </AdjustSheet>

      <AdjustSheet open={sheet === "excluded"} onClose={close} title="Meals marked not for me">
        {excludedCount === 0 ? (
          <p className="sheet-note">You haven't marked any meals not for me. Tap the × next to a meal on your plan to skip it for good.</p>
        ) : (
          <div>
            {household.excluded_meals.map((id) => (
              <div key={id} className="weekitem">
                <span className="name">{meals[id]?.name ?? id}</span>
                <button type="button" className="link" onClick={() => addBack(id)}>
                  Add back
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="btn-primary" onClick={close}>
          Done
        </button>
      </AdjustSheet>
    </div>
  );
}
