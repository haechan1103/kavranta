import "./TopBar.css";

import { useI18n } from "../i18n";

interface Props {
  projectName: string | null;
  location: string | null;
  onOpenPalette: () => void;
  onPush?: () => void;
}

/** Where you are, the one search entry, and the most common outbound action. */
export function TopBar({ projectName, location, onOpenPalette, onPush }: Props) {
  const { t } = useI18n();
  return (
    <header className="top-bar">
      <nav className="top-bar-location" aria-label={t("topBar.location")}>
        {projectName && <span className="top-bar-project">{projectName}</span>}
        {projectName && location && <span className="top-bar-separator" aria-hidden="true">/</span>}
        {location && <span className="top-bar-current" aria-current="page">{location}</span>}
      </nav>
      <button type="button" className="top-bar-search" onClick={onOpenPalette}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
        <span>{t("palette.input")}</span>
        <kbd>⌘K</kbd>
      </button>
      <div className="top-bar-actions">
        {onPush && (
          <button type="button" className="quiet-button compact" onClick={onPush}>
            {t("push.headerAction")}
          </button>
        )}
      </div>
    </header>
  );
}
