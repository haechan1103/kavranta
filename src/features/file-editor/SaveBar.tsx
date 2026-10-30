import "./SaveBar.css";
import { useState } from "react";

import { useI18n } from "../../i18n";
import type { PendingChange } from "./usePendingChanges";

interface Props {
  changes: PendingChange[];
  orphaned: string[];
  saving: boolean;
  onRevertAll: () => void;
  onRevert: (key: string) => void;
  onSave: () => void;
}

/** The single place that says what Save will write (ADR-0042). */
export function SaveBar({ changes, orphaned, saving, onRevertAll, onRevert, onSave }: Props) {
  const { t } = useI18n();
  const [reviewing, setReviewing] = useState(false);
  if (changes.length === 0) return null;

  const replaced = changes.filter((change) => change.kind === "replace").length;
  const removed = changes.length - replaced;
  const files = [...new Set(changes.flatMap((change) => change.files))];
  const savable = changes.length - orphaned.length;
  const parts = [
    replaced > 0 ? t("save.replaced", { count: replaced }) : null,
    removed > 0 ? t("save.removed", { count: removed }) : null,
    files.length === 1 ? files[0] : t("save.files", { count: files.length }),
  ].filter(Boolean);

  return (
    <div className="save-bar" role="region" aria-label={t("save.region")}>
      {reviewing && (
        <ul className="save-review" aria-label={t("save.reviewList")}>
          {changes.map((change) => (
            <li key={`${change.kind}:${change.key}`}>
              <span className={`pending-chip ${change.kind}`}>
                {change.kind === "replace" ? t("row.pendingReplace") : t("row.pendingRemoval")}
              </span>
              <code>{change.key}</code>
              <span className="save-review-files">
                {orphaned.includes(change.key) ? t("save.orphaned") : change.files.join(" · ")}
              </span>
              <button type="button" className="text-action" onClick={() => onRevert(change.key)}>{t("row.revert")}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="save-bar-main">
        <span className="save-bar-dot" aria-hidden="true" />
        <p className="save-bar-summary">
          <strong>{t("save.pending", { count: changes.length })}</strong>
          <span>{parts.join(" · ")}</span>
        </p>
        <button
          type="button"
          className="quiet-button"
          aria-expanded={reviewing}
          onClick={() => setReviewing((open) => !open)}
        >
          {reviewing ? t("save.hideReview") : t("save.review")}
        </button>
        <button type="button" className="quiet-button" disabled={saving} onClick={onRevertAll}>
          {t("save.revertAll")}
        </button>
        <button type="button" className="primary-button" disabled={saving || savable === 0} onClick={onSave}>
          {saving
            ? t("save.saving")
            : files.length > 1
              ? t("row.saveLinked", { count: files.length })
              : t("common.save")}
          <kbd>⌘S</kbd>
        </button>
      </div>
    </div>
  );
}
