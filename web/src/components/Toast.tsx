import { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import { useApp } from "../state";
import type { Plan } from "../types";

const SHOW_MS = 4000;
const QUIET_AFTER_MS = 400;

/** Feedback for every re-solve: the plan's what_changed line for 4 s (tap to dismiss), and a quiet
 *  "Updating your plan…" while a solve runs longer than 400 ms. Mounted once in App; reads only from context. */
export default function Toast() {
  const { plan, prevPlan, solving } = useApp();
  const [message, setMessage] = useState<string | null>(null);
  const [quiet, setQuiet] = useState(false);
  const shownFor = useRef<Plan | null>(null);
  const hideTimer = useRef<number | null>(null);

  // A new plan object with a what_changed line (and a previous plan to have changed from) shows a toast.
  useEffect(() => {
    if (!plan || plan === shownFor.current) return;
    shownFor.current = plan;
    const text = plan.what_changed?.trim();
    if (!text || !prevPlan) return;
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
