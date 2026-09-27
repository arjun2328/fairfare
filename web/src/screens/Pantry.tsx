// F3: what's already in the kitchen, so the solver only buys the gap. Levels only, never grams
// claimed from a photo; grams come back from POST /pantry/grams and land in household.pantry.
import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Camera, Check } from "lucide-react";
import { useApp } from "../state";
import { api, ApiError } from "../api";
import StapleChips from "../components/StapleChips";
import PantryChecklist from "../components/PantryChecklist";
import type { PantryItem } from "../types";

const MAX_DIM = 1024;

function mergeItems(base: PantryItem[], incoming: PantryItem[]): PantryItem[] {
  const byId = new Map(base.map((p) => [p.ingredient_id, p]));
  for (const item of incoming) byId.set(item.ingredient_id, item);
  return Array.from(byId.values());
}

/** Downscale to at most MAX_DIM px on the long side and return base64 JPEG, no data-url prefix. */
async function fileToBase64Jpeg(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode failed"));
    image.src = dataUrl;
  });
  let { width, height } = img;
  if (width > height && width > MAX_DIM) {
    height = Math.round((height * MAX_DIM) / width);
    width = MAX_DIM;
  } else if (height >= width && height > MAX_DIM) {
    width = Math.round((width * MAX_DIM) / height);
    height = MAX_DIM;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  ctx.drawImage(img, 0, 0, width, height);
  const jpeg = canvas.toDataURL("image/jpeg", 0.85);
  const comma = jpeg.indexOf(",");
  return comma >= 0 ? jpeg.slice(comma + 1) : jpeg;
}

const NOTHING_RECOGNIZED = "Nothing recognized from our list. Add items yourself or try again.";
const COMPOSER_DEFAULT = "Type items and tap Add — we'll match them to our list.";

export default function Pantry() {
  const { household, plan, ingredients, pantryItems, setPantryItems, setHousehold, resolveNow } = useApp();

  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);

  const [textValue, setTextValue] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [textMsg, setTextMsg] = useState<string | null>(null);

  const [confirmStatus, setConfirmStatus] = useState<"idle" | "saving" | "done">("idle");
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  // Wait for the household update (pantry grams) to land before forcing a solve, so resolveNow
  // reads the fresh household rather than a stale ref from before this render committed.
  useEffect(() => {
    if (!pendingConfirm) return;
    setPendingConfirm(false);
    void resolveNow().then(() => setConfirmStatus("done"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConfirm, household]);

  if (!household) return null;

  async function handlePhotoFile(file: File) {
    setPhotoLoading(true);
    setPhotoMsg(null);
    try {
      const image_b64 = await fileToBase64Jpeg(file);
      const detected = await api.pantryDetect({ image_b64 });
      if (detected.length === 0) {
        setPhotoMsg(NOTHING_RECOGNIZED);
      } else {
        setPantryItems(mergeItems(pantryItems, detected));
      }
    } catch {
      setPhotoMsg("Couldn't read that photo. Try more light, or type what you have.");
    } finally {
      setPhotoLoading(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handlePhotoFile(file);
  }

  async function handleTextDetect() {
    const text = textValue.trim();
    if (!text) return;
    setTextLoading(true);
    setTextMsg(null);
    try {
      const detected = await api.pantryDetect({ text });
      if (detected.length === 0) {
        setTextMsg(NOTHING_RECOGNIZED);
      } else {
        setPantryItems(mergeItems(pantryItems, detected));
        setTextValue("");
      }
    } catch {
      setTextMsg("Couldn't read that note. Try again, or add items yourself.");
    } finally {
      setTextLoading(false);
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleTextDetect();
    }
  }

  async function handleConfirm() {
    if (!household) return;
    setConfirmStatus("saving");
    setConfirmMsg(null);
    try {
      const grams = await api.pantryGrams(pantryItems);
      setHousehold({ pantry: grams, assume_staples: household.assume_staples });
      setPendingConfirm(true);
    } catch (err) {
      setConfirmStatus("idle");
      setConfirmMsg(err instanceof ApiError ? err.detail : "Couldn't save your pantry. Try again.");
    }
  }

  const fromPantryEntries = plan ? Object.entries(plan.from_pantry) : [];
  const composerHint = textLoading ? "Reading your note…" : (textMsg ?? COMPOSER_DEFAULT);

  return (
    <div className="screen">
      <div className="topbar">
        <h2>Your pantry</h2>
      </div>
      <p className="quiz-sub">We'll only buy what you don't have. Amounts are estimates.</p>

      <section className="composer">
        <div className="composer-row">
          <input
            type="text"
            placeholder="Type what you have, comma separated"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={onComposerKeyDown}
          />
          <button
            type="button"
            className="composer-add"
            disabled={textLoading || !textValue.trim()}
            onClick={() => void handleTextDetect()}
          >
            Add
          </button>
        </div>
        <p className="composer-hint">{composerHint}</p>
      </section>

      <label className="scan-btn">
        <Camera className="ic" aria-hidden="true" />
        <strong>Scan your pantry</strong>
        <span>Snap a photo and we'll spot what you've got.</span>
        <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onFileChange} />
      </label>
      {(photoLoading || photoMsg) && (
        <p className="composer-hint" style={{ marginTop: -12, marginBottom: 20 }}>
          {photoLoading ? "Reading your photo…" : photoMsg}
        </p>
      )}

      <StapleChips />

      <PantryChecklist />

      <button
        type="button"
        className="btn-primary"
        disabled={confirmStatus === "saving"}
        onClick={() => void handleConfirm()}
      >
        {confirmStatus === "saving" ? "Saving…" : "Save pantry"}
      </button>
      {confirmMsg && <p className="composer-hint">{confirmMsg}</p>}

      {confirmStatus === "done" && (
        <div style={{ marginTop: 18 }}>
          <div className="infobox">
            <Check className="ic" aria-hidden="true" />
            <span>Saved. Your cart just got shorter.</span>
          </div>
          {fromPantryEntries.length > 0 ? (
            fromPantryEntries.map(([id, grams]) => (
              <div key={id} className="ing have">
                <div className="ing-top">
                  <span className="dot" aria-hidden="true" />
                  <span className="name">{ingredients[id]?.name ?? id}</span>
                  <span className="subnote">estimated {grams} g</span>
                </div>
              </div>
            ))
          ) : (
            <p className="subnote">This trip's meals didn't need anything from your pantry.</p>
          )}
        </div>
      )}
    </div>
  );
}
