import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LandingPage } from "./LandingPage";
import { SiteLocale } from "./SiteLocale";
import "./styles.css";

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <SiteLocale><LandingPage /></SiteLocale>
    </StrictMode>,
  );
