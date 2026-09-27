import { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import { useApp } from "../state";
import { fmtMoney } from "../format";
import type { Plan } from "../types";

const SHOW_MS = 4000;
const QUIET_AFTER_MS = 400;

/** Feedback for every re-solve: the plan's what_changed line for 4 s (tap to dismiss), and a quiet
 *  "Updating your plan…" while a solve runs longer than 400 ms. Mounted once in App; reads only from context. */
export default function Toast() {
  const { plan, prevPlan, solving, household, meals } = useApp();
  const [message, setMessage] = useState<string | null>(null);
  const [quiet, setQuiet] = useState(false);
  const shownFor = useRef<Plan | null>(null);
  const hideTimer = useRef<number | null>(null);

  // A new plan object shows a toast: first a dropped pin (the user's tap did not take), else what_changed.
  useEffect(() => {
    if (!plan || plan === shownFor.current) return;
    shownFor.current = plan;
    let text = plan.what_changed?.trim() || "";
    if (plan.relaxed.includes("pins")) {
      const dropped = (household?.required_meals ?? []).find((id) => !(plan.meals[id] > 0));
      if (dropped) {
        const name = meals[dropped]?.name ?? "That recipe";
        text = `${name} didn't fit this trip's ${fmtMoney(plan.trip_snap_cap_cents)}. Raise your balance or remove a meal.`;
      }
    }
    if (!text || (!prevPlan && !plan.relaxed.includes("pins"))) return;
    setMessage(text);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setMessage(null);
      hideTimer.current = null;
    }, SHOW_MS);
  }, [plan, prevPlan]);

  useEffect(
    () => () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    },
    [],
  );

  // Only solves that take a noticeable moment get the quiet toast, so quick ones don't flicker.
  useEffect(() => {
    if (!solving) {
      setQuiet(false);
      return;
    }
    const t = window.setTimeout(() => setQuiet(true), QUIET_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [solving]);

  const dismiss = () => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setMessage(null);
  };

  if (message) {
    return (
      <div className="toast" role="status" aria-live="polite" onClick={dismiss}>
        <Leaf className="ic" aria-hidden="true" />
        <span className="toast__text">{message}</span>
      </div>
    );
  }
  if (quiet) {
    return (
      <div className="toast toast--quiet" role="status" aria-live="polite">
        <span className="toast__text">Updating your plan…</span>
      </div>
    );
  }
  return null;
}
