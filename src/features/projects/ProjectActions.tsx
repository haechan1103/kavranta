import "./ProjectActions.css";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

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

/**
 * The project's share section: the frequent outbound flows are direct sidebar entries,
 * and only rare project housekeeping stays behind a menu.
 */
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
  // The sidebar scrolls, which would clip a menu that opens beside it, so the menu is
  // fixed to the window at the trigger's position.
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus({ preventScroll: true });
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !actionsRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    // Follow the trigger when the sidebar scrolls or the window resizes.
    const follow = () => setAnchor(anchorFor(triggerRef.current));
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", follow);
    document.addEventListener("scroll", follow, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", follow);
      document.removeEventListener("scroll", follow, true);
    };
  }, [open]);

  const toggle = () => {
    setAnchor(anchorFor(triggerRef.current));
    setOpen((current) => !current);
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items.at(-1)?.focus();
    }
  };

  return (
    <div className="project-share-actions">
      <button className="nav-item" onClick={onPush}>
        <SidebarNavIcon name="push" /> {t("push.headerAction")}
      </button>
      <button className="nav-item" onClick={onShare}>
        <SidebarNavIcon name="share" /> {t("teamChannel.headerAction")}
      </button>
      <button className="nav-item" onClick={onRunAction}>
        <SidebarNavIcon name="run" /> {t("action.headerAction")}
      </button>
      <div className="project-action-menu" ref={actionsRef}>
        <button
          ref={triggerRef}
          className="nav-item sidebar-project-action-trigger"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={toggle}
        >
          <SidebarNavIcon name="actions" />
          <span>{t("app.projectActions")}</span>
          <span className="project-actions-chevron" aria-hidden="true">›</span>
        </button>
        {open && (
          <div
            ref={menuRef}
            className="project-action-popover"
            role="menu"
            aria-label={t("app.projectActions")}
            style={anchor ? { left: anchor.left, bottom: anchor.bottom } : undefined}
            onKeyDown={moveFocus}
          >
            <button role="menuitem" onClick={() => run(onExport)}>{t("export.action")}</button>
            <button role="menuitem" onClick={() => run(onImport)}>{t("import.headerAction")}</button>
            <div className="project-action-divider" role="separator" />
            <button role="menuitem" onClick={() => run(onRename)}>{t("common.rename")}</button>
            <button role="menuitem" onClick={() => run(onRefresh)}>{t("common.refresh")}</button>
            <div className="project-action-divider" role="separator" />
            <button className="danger-menu-item" role="menuitem" onClick={() => run(onRemove)}>
              {t("app.removeRegistration")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function anchorFor(trigger: HTMLElement | null) {
  const rect = trigger?.getBoundingClientRect();
  return rect ? { left: rect.right + 10, bottom: window.innerHeight - rect.bottom - 7 } : null;
}
