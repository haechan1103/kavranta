import "./CommandPalette.css";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useI18n } from "../../i18n";

export type PaletteGroup = "variables" | "files" | "views" | "commands";

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  detail?: string;
  run: () => void;
}

interface Props {
  items: PaletteItem[];
  onClose: () => void;
}

const groupOrder: PaletteGroup[] = ["variables", "files", "views", "commands"];
const resultLimit = 40;

/**
 * ⌘K search over names only: variable keys, file paths, views and commands. It never
 * receives or searches values.
 */
export function CommandPalette({ items, onClose }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useEffect(() => {
    inputRef.current?.focus();
    const returnFocus = returnFocusRef.current;
    return () => returnFocus?.focus();
  }, []);

  const results = useMemo(() => rank(items, query).slice(0, resultLimit), [items, query]);
  const grouped = groupOrder
    .map((group) => ({ group, items: results.filter((item) => item.group === group) }))
    .filter((section) => section.items.length > 0);
  const ordered = grouped.flatMap((section) => section.items);

  useEffect(() => setActive(0), [query]);

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(ordered.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(ordered[active]);
    } else if (event.key === "Tab") {
      event.preventDefault();
    }
  };

  const activeItem = ordered[active];

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="command-palette" role="dialog" aria-modal="true" aria-label={t("palette.label")} onKeyDown={onKeyDown}>
        <div className="palette-input-row">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeItem ? `${listId}-${activeItem.id}` : undefined}
            aria-label={t("palette.input")}
            placeholder={t("palette.placeholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="palette-note">{t("palette.namesOnly")}</span>
        </div>
        <div className="palette-results" id={listId} role="listbox" aria-label={t("palette.results")}>
          {ordered.length === 0 && <p className="palette-empty">{t("palette.empty")}</p>}
          {grouped.map((section) => (
            <div role="group" aria-label={t(groupLabel(section.group))} key={section.group}>
              <div className="palette-group-label" aria-hidden="true">{t(groupLabel(section.group))}</div>
              {section.items.map((item) => {
                const index = ordered.indexOf(item);
                return (
                  <div
                    key={item.id}
                    id={`${listId}-${item.id}`}
                    role="option"
                    aria-selected={index === active}
                    className={`palette-option${index === active ? " active" : ""}`}
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(item)}
                  >
                    <span className={item.group === "variables" ? "palette-label mono" : "palette-label"}>{item.label}</span>
                    {item.detail && <span className="palette-detail">{item.detail}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="palette-footer" aria-hidden="true">
          <span><kbd>↑↓</kbd> {t("palette.move")}</span>
          <span><kbd>↵</kbd> {t("palette.choose")}</span>
          <span><kbd>esc</kbd> {t("palette.close")}</span>
        </div>
      </div>
    </div>
  );
}

function groupLabel(group: PaletteGroup) {
  if (group === "variables") return "palette.variables" as const;
  if (group === "files") return "palette.files" as const;
  if (group === "views") return "palette.views" as const;
  return "palette.commands" as const;
}

/** Every word must match; a label that starts with the query ranks first. */
export function rank(items: PaletteItem[], query: string): PaletteItem[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items.filter((item) => item.group !== "variables");
  return items
    .map((item) => {
      const label = item.label.toLocaleLowerCase();
      const haystack = `${label} ${(item.detail ?? "").toLocaleLowerCase()}`;
      if (!words.every((word) => haystack.includes(word))) return null;
      const first = words[0] ?? "";
      const score = label.startsWith(first) ? 0 : label.includes(first) ? 1 : 2;
      return { item, score };
    })
    .filter((entry): entry is { item: PaletteItem; score: number } => entry !== null)
    .sort((left, right) => left.score - right.score)
    .map((entry) => entry.item);
}
