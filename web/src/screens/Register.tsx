import { useEffect, type CSSProperties } from "react";
import { ChevronLeft } from "lucide-react";
import { useApp } from "../state";
import { fmtMoney } from "../format";

const FULLSCREEN_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  overflow: "auto",
  background: "var(--green-deep)",
  color: "#fff",
  paddingTop: "calc(16px + env(safe-area-inset-top, 0px))",
  paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
  paddingLeft: "calc(16px + env(safe-area-inset-left, 0px))",
  paddingRight: "calc(16px + env(safe-area-inset-right, 0px))",
};

export default function Register() {
  const { plan, navigate } = useApp();

  // Keep the screen awake while showing the cashier; fail silently where unsupported.
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.wakeLock?.request("screen");
        if (cancelled) {
          void s?.release();
        } else {
          sentinel = s ?? null;
        }
      } catch {
        /* wake lock unavailable; ignore */
      }
    })();
    return () => {
      cancelled = true;
      void sentinel?.release();
    };
  }, []);

  if (!plan) {
    return (
      <div className="stack" style={FULLSCREEN_STYLE}>
        <button type="button" className="quiz-back" style={{ color: "#fff" }} onClick={() => navigate("/list")}>
          <ChevronLeft className="ic" aria-hidden="true" />
        </button>
        <p className="muted" style={{ color: "rgba(255,255,255,0.85)" }}>
          No plan yet.
        </p>
        <button type="button" className="link" style={{ color: "#fff" }} onClick={() => navigate("/plan")}>
          Go to Plan
        </button>
      </div>
    );
  }

  return (
    <div style={FULLSCREEN_STYLE}>
      <div className="stack">
        <button
          type="button"
          className="quiz-back"
          style={{ color: "#fff" }}
          onClick={() => navigate("/list")}
          aria-label="Back to list"
        >
          <ChevronLeft className="ic" aria-hidden="true" />
        </button>

        <div className="stack" style={{ marginTop: 24 }}>
          <p style={{ fontSize: 15, opacity: 0.85 }}>Swipe EBT first</p>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 60, lineHeight: 1.05, color: "#fff", margin: 0 }}>
            {fmtMoney(plan.ebt_cents)}
          </p>
        </div>

        {plan.cash_cents > 0 ? (
          <div className="stack" style={{ marginTop: 32 }}>
            <p style={{ fontSize: 15, opacity: 0.85 }}>Then card</p>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 60, lineHeight: 1.05, color: "#fff", margin: 0 }}>
              {fmtMoney(plan.cash_cents)}
            </p>
          </div>
        ) : (
          <p className="strong" style={{ marginTop: 16, fontSize: 18 }}>
            That's everything.
          </p>
        )}

        <p className="small" style={{ marginTop: 40, color: "rgba(255,255,255,0.85)" }}>
          Entered manually — not connected to your EBT account.
        </p>

        <button
          type="button"
          className="btn-line"
          style={{ background: "transparent", borderColor: "rgba(255,255,255,0.5)", color: "#fff", marginTop: 12 }}
          onClick={() => navigate("/list")}
        >
          Back to list.
        </button>
      </div>
    </div>
  );
}
