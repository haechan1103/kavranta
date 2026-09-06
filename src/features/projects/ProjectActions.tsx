import "./ProjectActions.css";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "../../i18n";
import { SidebarNavIcon } from "./SidebarNavIcon";

interface Props {
  onRename: () => void;
  onExport: () => void;
  onImport: () => void;
  onShare: () => void;
  onPush: () => void;
  onRunAction: () => void;
  onRefresh: () => void;
  onRemove: () => void;
}

export function ProjectActions({
  onRename,
  onExport,
  onImport,
  onShare,
  onPush,
  onRunAction,
  onRefresh,
  onRemove,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !actionsRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="project-action-bar" ref={actionsRef} aria-label={t("app.projectActions")}>
      <div className="project-action-menu">
        <button
          className="nav-item sidebar-project-action-trigger"
          aria-label={t("app.projectActions")}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((current) => !current)}
        >
          <SidebarNavIcon name="actions" />
          <span>{t("app.projectActions")}</span>
          <span className="project-actions-chevron" aria-hidden="true">›</span>
        </button>
        {open && (
          <div className="project-action-popover" role="menu">
            <button role="menuitem" onClick={() => run(onPush)}>{t("push.headerAction")}</button>
            <button role="menuitem" onClick={() => run(onRunAction)}>{t("action.headerAction")}</button>
            <div className="project-action-divider" />
            <button role="menuitem" onClick={() => run(onExport)}>{t("export.action")}</button>
            <button role="menuitem" onClick={() => run(onImport)}>{t("import.headerAction")}</button>
            <button role="menuitem" onClick={() => run(onShare)}>{t("teamChannel.headerAction")}</button>
            <div className="project-action-divider" />
            <button role="menuitem" onClick={() => run(onRename)}>{t("common.rename")}</button>
            <button role="menuitem" onClick={() => run(onRefresh)}>{t("common.refresh")}</button>
            <div className="project-action-divider" />
            <button className="danger-menu-item" role="menuitem" onClick={() => run(onRemove)}>
              {t("app.removeRegistration")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
