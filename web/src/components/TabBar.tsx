import { BookOpen, CalendarDays, House, Leaf, Refrigerator } from "lucide-react";
import { useApp, type Path } from "../state";

const TABS: { path: Path; label: string; Icon: typeof House }[] = [
  { path: "/home", label: "Home", Icon: House },
  { path: "/plan", label: "Week", Icon: CalendarDays },
  { path: "/pantry", label: "Pantry", Icon: Refrigerator },
  { path: "/cookbook", label: "Cookbook", Icon: BookOpen },
  { path: "/profile", label: "Profile", Icon: Leaf },
];

/** Bottom navigation. List and Register are reached from the plan, not from here. */
export default function TabBar() {
  const { path, navigate } = useApp();
  const active = (p: Path) => path === p || (p === "/plan" && (path === "/list" || path === "/register"));
  return (
    <nav className="navbar" aria-label="Main">
      {TABS.map(({ path: p, label, Icon }) => (
        <button
          key={p}
          type="button"
          className={`navbtn${active(p) ? " active" : ""}`}
          onClick={() => navigate(p)}
          aria-current={active(p) ? "page" : undefined}
        >
          <Icon className="ic" aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  );
}
