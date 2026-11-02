import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";

const Router = import.meta.env.DEV ? HashRouter : BrowserRouter;
const routerProps = import.meta.env.DEV ? {} : { basename: "/dashboard" };

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router {...routerProps}>
      <App />
    </Router>
  </React.StrictMode>,
);
