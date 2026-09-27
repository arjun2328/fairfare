// The one React context. Any change to `household` re-solves after a 300 ms debounce; List and
// Register only read `plan` from here and never refetch.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "./api";
import type { Household, Ingredient, Meal, PantryItem, Plan } from "./types";

export type Path = "/quiz" | "/plan" | "/pantry" | "/list" | "/register";
const PATHS: Path[] = ["/quiz", "/plan", "/pantry", "/list", "/register"];

const LS = { household: "stretch.household", pantry: "stretch.pantryItems", session: "stretch.sessionId" };

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}
function newSessionId(): string {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function currentPath(): Path {
  const p = window.location.pathname as Path;
  return PATHS.includes(p) ? p : "/plan";
}

export interface AppState {
  household: Household | null; // null until the quiz finishes
  plan: Plan | null;
  prevPlan: Plan | null;
  pantryItems: PantryItem[];
  sessionId: string;
  ingredients: Record<string, Ingredient>; // id -> Ingredient, loaded once from /ingredients
  meals: Record<string, Meal>; // id -> Meal, the candidate pool from /meals
  solving: boolean;
  solveError: string | null; // plain-language 422 detail; shown in the ChangedLine slot
  apiOk: boolean | null; // null = not checked yet
  path: Path;
}

export interface AppActions {
  navigate(path: Path): void;
  /** Merge fields into the household; a re-solve follows after 300 ms. */
  setHousehold(patch: Partial<Household>): void;
  /** Quiz completion or "typical settings": replace the household and go to /plan. */
  startHousehold(h: Household): void;
  /** "Redo setup": forget household and plan, go to /quiz. */
  resetHousehold(): void;
  setPantryItems(items: PantryItem[]): void;
  /** Force a solve now (e.g. after Pantry confirm). */
  resolveNow(): Promise<void>;
}

const Ctx = createContext<(AppState & AppActions) | null>(null);

export function StateProvider({ children }: { children: ReactNode }) {
  const [household, setHouseholdState] = useState<Household | null>(() => readLS<Household | null>(LS.household, null));
  const [plan, setPlan] = useState<Plan | null>(null);
  const [prevPlan, setPrevPlan] = useState<Plan | null>(null);
  const [pantryItems, setPantryItemsState] = useState<PantryItem[]>(() => readLS<PantryItem[]>(LS.pantry, []));
  const [sessionId] = useState<string>(() => {
    const existing = readLS<string | null>(LS.session, null);
    if (existing) return existing;
    const id = newSessionId();
    writeLS(LS.session, id);
    return id;
  });
  const [ingredients, setIngredients] = useState<Record<string, Ingredient>>({});
  const [meals, setMeals] = useState<Record<string, Meal>>({});
  const [solving, setSolving] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [path, setPath] = useState<Path>(() => currentPath());

  const planRef = useRef<Plan | null>(null);
  planRef.current = plan;
  const householdRef = useRef<Household | null>(household);
  householdRef.current = household;
  const solveSeq = useRef(0);

  // ---- router -------------------------------------------------------------------------------
  const navigate = useCallback((p: Path) => {
    if (window.location.pathname !== p) window.history.pushState(null, "", p);
    setPath(p);
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    // first run goes to the quiz; a returning household never lands on the quiz by accident
    if (!household && path !== "/quiz") {
      window.history.replaceState(null, "", "/quiz");
      setPath("/quiz");
    }
  }, [household, path]);

  // ---- reference data ------------------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    api
      .health()
      .then(() => alive && setApiOk(true))
      .catch(() => alive && setApiOk(false));
    api
      .ingredients()
      .then((list) => alive && setIngredients(Object.fromEntries(list.map((i) => [i.id, i]))))
      .catch(() => undefined);
    api
      .meals(sessionId)
      .then((list) => alive && setMeals(Object.fromEntries(list.map((m) => [m.id, m]))))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [sessionId]);

  // ---- solving -------------------------------------------------------------------------------
  const runSolve = useCallback(async () => {
    const hh = householdRef.current;
    if (!hh) return;
    const seq = ++solveSeq.current;
    setSolving(true);
    try {
      const next = await api.solve(hh, planRef.current, sessionId);
      if (seq !== solveSeq.current) return; // a newer solve superseded this one
      setPrevPlan(planRef.current);
      setPlan(next);
      setSolveError(null);
      setApiOk(true);
    } catch (err) {
      if (seq !== solveSeq.current) return;
      if (err instanceof ApiError) setSolveError(err.detail);
      else {
        setSolveError("Can't reach the planner right now. Your plan below is the last one we had.");
        setApiOk(false);
      }
    } finally {
      if (seq === solveSeq.current) setSolving(false);
    }
  }, [sessionId]);

  useEffect(() => {
    writeLS(LS.household, household);
    if (!household) return;
    const t = window.setTimeout(() => void runSolve(), 300);
    return () => window.clearTimeout(t);
  }, [household, runSolve]);

  useEffect(() => {
    writeLS(LS.pantry, pantryItems);
  }, [pantryItems]);

  // ---- actions -------------------------------------------------------------------------------
  const setHousehold = useCallback((patch: Partial<Household>) => {
    setHouseholdState((h) => (h ? { ...h, ...patch } : h));
  }, []);
  const startHousehold = useCallback(
    (h: Household) => {
      setPlan(null);
      setPrevPlan(null);
      setSolveError(null);
      setHouseholdState(h);
      navigate("/plan");
    },
    [navigate],
  );
  const resetHousehold = useCallback(() => {
    // Keep the household so the quiz pre-fills; startHousehold() replaces it when they finish.
    setSolveError(null);
    navigate("/quiz");
  }, [navigate]);
  const setPantryItems = useCallback((items: PantryItem[]) => setPantryItemsState(items), []);

  const value = useMemo<AppState & AppActions>(
    () => ({
      household,
      plan,
      prevPlan,
      pantryItems,
      sessionId,
      ingredients,
      meals,
      solving,
      solveError,
      apiOk,
      path,
      navigate,
      setHousehold,
      startHousehold,
      resetHousehold,
      setPantryItems,
      resolveNow: runSolve,
    }),
    [household, plan, prevPlan, pantryItems, sessionId, ingredients, meals, solving, solveError, apiOk, path,
     navigate, setHousehold, startHousehold, resetHousehold, setPantryItems, runSolve],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState & AppActions {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside StateProvider");
  return v;
}
