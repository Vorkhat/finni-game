import { Finale, PetAlbum } from "./screens/Finale";
import { render } from "solid-js/web";
import { Route, Router } from "@solidjs/router";
import { Home } from "./screens/Home";
import { App } from "./App";
import { Onboarding } from "./screens/Onboarding";
import { PetCreate } from "./screens/PetCreate";
import { GoalSelect } from "./screens/GoalSelect";
import { Section } from "./screens/Section";
import { Settings } from "./screens/Settings";
import { Budget, DayStart } from "./screens/Budget";
import { PeriodResult } from "./screens/PeriodResult";
import { Evolution } from "./screens/Evolution";
import { Progress } from "./screens/Progress";
import { Shop } from "./screens/Shop";
import { Savings } from "./screens/Savings";
import { Tasks, TaskPlay } from "./screens/Tasks";
import { Situations, SituationPlay } from "./screens/Situations";
import { AdultDashboard, AdultGate } from "./screens/Adult";
import "./styles.css";
import "./gameplay.css";
import "./periods.css";
import "./stage4.css";
import "./home.css";

render(
  () => (
    <Router root={App}>
      <Route path={["/", "/boot"]} component={() => null} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/pet/create" component={() => <PetCreate />} />
      <Route path="/pet/new" component={() => <PetCreate newStory />} />
      <Route path="/pet/album" component={PetAlbum} />
      <Route path="/finale" component={Finale} />
      <Route path="/goal/select" component={GoalSelect} />
      <Route path="/home" component={Home} />
      <Route path="/settings" component={Settings} />
      <Route path="/day/start" component={DayStart} />
      <Route path={["/day/result", "/day/result/:id"]} component={PeriodResult} />
      <Route path="/day/evolution" component={Evolution} />
      <Route path="/budget" component={Budget} />
      <Route path="/shop" component={Shop} />
      <Route path="/savings" component={Savings} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/tasks/:id" component={TaskPlay} />
      <Route path="/situations" component={Situations} />
      <Route path="/situations/:id" component={SituationPlay} />
      <Route path="/progress" component={Progress} />
      <Route path="/adult" component={AdultGate} />
      <Route path="/adult/dashboard" component={AdultDashboard} />
      <Route path="*" component={Section} />
    </Router>
  ),
  document.getElementById("root")!,
);
