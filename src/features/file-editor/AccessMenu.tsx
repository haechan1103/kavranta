import "./AccessMenu.css";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { HelpIcon, LockIcon, UnlockIcon } from "../../components/icons";
import { useI18n, type TranslationKey } from "../../i18n";
import type { CodexAccess } from "../../lib/types";

interface Props {
  variableKey: string;
  access: CodexAccess;
  onChange: (access: CodexAccess) => void;
}

const options: { value: CodexAccess; label: TranslationKey; hint: TranslationKey }[] = [
  { value: "protected", label: "row.protected", hint: "row.accessHintProtected" },
  { value: "read-write", label: "row.readWrite", hint: "row.accessHintReadWrite" },
  { value: "unclassified", label: "row.unclassified", hint: "row.accessHintUnclassified" },
];

/** The AI policy as one icon; its name lives in the tooltip, the accessible name and the menu. */
export function AccessMenu({ variableKey, access, onChange }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === access) ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[aria-checked='true']")?.focus({ preventScroll: true });
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", dismiss);
    document.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", dismiss);
      document.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);

  const toggle = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpen((value) => !value);
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const choose = (value: CodexAccess) => {
    close();
    if (value !== access) onChange(value);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const label = t("row.accessCurrent", { key: variableKey, access: t(current.label) });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`access-button ${access}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${t(current.label)} · ${t(current.hint)}`}
        onClick={toggle}
      >
        <AccessIcon access={access} />
      </button>
      {open && anchor && (
        <div
          ref={menuRef}
          className="access-menu"
          role="menu"
          aria-label={t("row.aiAccess", { key: variableKey })}
          style={{ top: anchor.top, right: anchor.right }}
          onKeyDown={onMenuKeyDown}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === access}
              className={option.value}
              onClick={() => choose(option.value)}
            >
              <AccessIcon access={option.value} />
              <span>
                <strong>{t(option.label)}</strong>
                <small>{t(option.hint)}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function AccessIcon({ access }: { access: CodexAccess }) {
  if (access === "protected") return <LockIcon />;
  if (access === "read-write") return <UnlockIcon />;
  return <HelpIcon />;
}
