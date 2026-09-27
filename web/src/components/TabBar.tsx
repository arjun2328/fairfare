import { CalendarDays, ShoppingBasket, Refrigerator } from "lucide-react";
import { useApp, type Path } from "../state";

const TABS: { path: Path; label: string; Icon: typeof CalendarDays }[] = [
  { path: "/plan", label: "Plan", Icon: CalendarDays },
  { path: "/pantry", label: "Pantry", Icon: Refrigerator },
  { path: "/list", label: "List", Icon: ShoppingBasket },
];

export default function TabBar() {
  const { path, navigate } = useApp();
  return (
    <nav className="navbar" aria-label="Main">
      {TABS.map(({ path: p, label, Icon }) => (
        <button
          key={p}
          type="button"
          className={`navbtn${path === p ? " active" : ""}`}
          onClick={() => navigate(p)}
          aria-current={path === p ? "page" : undefined}
        >
          <Icon className="ic" aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  );
}
