import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { en, ko } from "./siteCopy";

export type SiteLanguage = "en" | "ko";
const Context = createContext({
  locale: "en" as SiteLanguage,
  copy: en,
  setLocale: (_locale: SiteLanguage) => {},
});

export function SiteLocale({ children }: { children: ReactNode }) {
  const [locale, setLanguage] = useState<SiteLanguage>(() =>
    new URLSearchParams(window.location.search).get("lang") === "ko"
      ? "ko"
      : "en",
  );
  const copy = locale === "ko" ? ko : en;
  const setLocale = (next: SiteLanguage) => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
    setLanguage(next);
  };
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = copy.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", copy.description);
  }, [locale, copy]);
  return (
    <Context.Provider value={{ locale, copy, setLocale }}>
      {children}
    </Context.Provider>
  );
}

export const useSiteLocale = () => useContext(Context);
