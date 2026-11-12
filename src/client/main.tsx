import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AdminPanel } from "./AdminPanel";
import { App } from "./App";
import { isAdmin } from "./condition";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdmin() ? <AdminPanel /> : <App />}
  </StrictMode>,
);
