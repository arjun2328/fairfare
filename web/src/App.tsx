import { StateProvider, useApp } from "./state";
import TabBar from "./components/TabBar";
import PlanBar from "./components/PlanBar";
import Quiz from "./screens/Quiz";
import Home from "./screens/Home";
import Plan from "./screens/Plan";
import Pantry from "./screens/Pantry";
import Cookbook from "./screens/Cookbook";
import Profile from "./screens/Profile";
import List from "./screens/List";
import Register from "./screens/Register";

function Shell() {
  const { path, apiOk } = useApp();
  const bare = path === "/quiz" || path === "/register";
  // The sticky plan bar shows wherever the plan itself is not on screen.
  const withPlanBar = path === "/home" || path === "/pantry" || path === "/cookbook" || path === "/profile";
  let screen;
  switch (path) {
    case "/quiz":
      screen = <Quiz />;
      break;
    case "/home":
      screen = <Home />;
      break;
    case "/pantry":
      screen = <Pantry />;
      break;
    case "/cookbook":
      screen = <Cookbook />;
      break;
    case "/profile":
      screen = <Profile />;
      break;
    case "/list":
      screen = <List />;
      break;
    case "/register":
      screen = <Register />;
      break;
    default:
      screen = <Plan />;
  }
  return (
    <div className={`app${bare ? " app--bare" : ""}${withPlanBar ? " has-planbar" : ""}`}>
      {apiOk === false && (
        <div className="warnbox" style={{ marginBottom: 16 }}>
          Can't reach the planner. Check that the API is running and this device is on the same hotspot.
        </div>
      )}
      {screen}
      {withPlanBar && <PlanBar />}
      {!bare && <TabBar />}
    </div>
  );
}

export default function App() {
  return (
    <StateProvider>
      <Shell />
    </StateProvider>
  );
}
