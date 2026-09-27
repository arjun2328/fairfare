import { StateProvider, useApp } from "./state";
import TabBar from "./components/TabBar";
import Quiz from "./screens/Quiz";
import Plan from "./screens/Plan";
import Pantry from "./screens/Pantry";
import List from "./screens/List";
import Register from "./screens/Register";

function Shell() {
  const { path, apiOk } = useApp();
  const bare = path === "/quiz" || path === "/register";
  let screen;
  switch (path) {
    case "/quiz":
      screen = <Quiz />;
      break;
    case "/pantry":
      screen = <Pantry />;
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
    <div className={`app${bare ? " app--bare" : ""}`}>
      {apiOk === false && (
        <div className="warnbox" style={{ marginBottom: 16 }}>
          Can't reach the planner. Check that the API is running and this device is on the same hotspot.
        </div>
      )}
      {screen}
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
