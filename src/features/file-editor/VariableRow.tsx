import "./VariableRow.css";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { useConfirm } from "../../components/ConfirmDialog";
import { CopyButton } from "../../components/CopyButton";
import { EyeIcon, EyeOffIcon, LinkIcon } from "../../components/icons";
import { useI18n } from "../../i18n";
import * as api from "../../lib/api";
import type { CodexAccess, OccurrenceProjection } from "../../lib/types";

/** Mirrors the delay in `copy_value` (src-tauri/src/commands/env_files.rs). */
const CLIPBOARD_CLEAR_SECONDS = 45;

interface Props {
  hidden?: boolean;
  projectId: string;
  file: string;
  variable: OccurrenceProjection;
  sameKeyFiles: string[];
  /** The staged replacement value, when the user has typed one. */
  draft: string | undefined;
  pendingRemoval: boolean;
  selected: boolean;
  checked: boolean;
  /** Changes after every save so a reveal never shows a value that was just replaced. */
  saveGeneration: number;
  onSelect: () => void;
  onCheck: (checked: boolean) => void;
  onDraftChange: (value: string) => void;
  onRevert: () => void;
  onMutate: (operation: () => Promise<unknown>, success: string) => Promise<void>;
}

export function VariableRow({
  hidden = false,
  projectId,
  file,
  variable,
  sameKeyFiles,
  draft,
  pendingRemoval,
  selected,
  checked,
  saveGeneration,
  onSelect,
  onCheck,
  onDraftChange,
  onRevert,
  onMutate,
}: Props) {
  const { t } = useI18n();
  const { confirm, dialog } = useConfirm();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealActivity, setRevealActivity] = useState(0);
  const revealedValueRef = useRef<HTMLTextAreaElement>(null);
  const revealRequest = useRef(0);
  const dirty = draft !== undefined;

  useLayoutEffect(() => {
    revealRequest.current += 1;
    if (hidden) setRevealed(null);
    return () => { revealRequest.current += 1; };
  }, [hidden, projectId, file, variable.key]);

  useLayoutEffect(() => {
    revealRequest.current += 1;
    setRevealed(null);
  }, [saveGeneration]);

  useEffect(() => {
    if (revealed === null) return;
    const timeout = window.setTimeout(() => setRevealed(null), 30000);
    return () => window.clearTimeout(timeout);
  }, [revealed, revealActivity]);

  useLayoutEffect(() => {
    const field = revealedValueRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 240)}px`;
  }, [revealed, draft]);

  const value = draft ?? revealed ?? "";
  const empty = variable.valueState === "empty" && !dirty;
  const placeholder = empty ? t("row.valueEmptyAction") : t("row.valuePresent");
  const unlinkedPeers = variable.linkId === null && sameKeyFiles.length > 1;

  const keepRevealActive = () => {
    if (revealed !== null) setRevealActivity((activity) => activity + 1);
  };

  const toggleReveal = () => {
    const request = ++revealRequest.current;
    if (revealed !== null) {
      setRevealed(null);
      return;
    }
    if (dirty) {
      setRevealed(draft);
      setRevealActivity((activity) => activity + 1);
      return;
    }
    void api
      .readValue(projectId, file, variable.key)
      .then((nextValue) => {
        if (request !== revealRequest.current) return;
        setRevealed(nextValue);
        setRevealActivity((activity) => activity + 1);
      })
      .catch(() => {
        if (request === revealRequest.current) setRevealed(null);
      });
  };

  const changeAccess = async (access: CodexAccess) => {
    const downgrade = access === "read-write" && variable.codexAccess !== "read-write";
    if (
      downgrade &&
      !(await confirm({
        title: t("row.accessConfirmTitle", { key: variable.key }),
        body: t("row.accessConfirm"),
        confirmLabel: t("row.allowAccess"),
      }))
    ) {
      return;
    }
    await onMutate(
      () => api.setCodexAccess(projectId, variable.key, access, downgrade),
      t("row.accessChanged", { key: variable.key }),
    );
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    keepRevealActive();
    if (event.key === "Escape" && dirty) {
      event.preventDefault();
      event.stopPropagation();
      onRevert();
    }
  };

  const rowState = pendingRemoval ? " pending-removal" : dirty ? " pending-replace" : "";

  return (
    <article
      hidden={hidden}
      className={`variable-row${selected ? " selected" : ""}${checked ? " checked" : ""}${variable.duplicate ? " has-error" : ""}${rowState}`}
      data-variable-key={variable.key}
      onClick={(event) => {
        if (event.target === event.currentTarget) onSelect();
      }}
    >
      <span className="row-check">
        <input
          type="checkbox"
          checked={checked}
          aria-label={t("row.select", { key: variable.key })}
          onChange={(event) => onCheck(event.target.checked)}
        />
      </span>

      <div className="variable-meta">
        <div className="key-line">
          <button type="button" className="key-button" aria-pressed={selected} onClick={onSelect}>
            {variable.key}
          </button>
          {!hidden && (
            <CopyButton
              className="key-copy-button"
              label={t("row.copyKeyLabel", { key: variable.key })}
              title={t("row.copyKey")}
              onCopy={() => api.copyKey(projectId, variable.key)}
            />
          )}
          {variable.duplicate && <span className="badge error">{t("row.duplicate")}</span>}
          {variable.clientExposure && (
            <span
              className="badge exposure"
              title={t("row.clientExposureHelp", {
                prefix: variable.clientExposure.publicPrefix,
                indicator: variable.clientExposure.secretIndicator,
              })}
            >
              {t("row.clientExposure")}
            </span>
          )}
        </div>
        {variable.description.length > 0 && (
          <span className="variable-description">{variable.description.join(" ")}</span>
        )}
      </div>

      {pendingRemoval ? (
        <div className="value-cell">
          <span className="pending-chip remove">{t("row.pendingRemoval")}</span>
          <button type="button" className="quiet-button compact" onClick={onRevert}>
            {t("row.restore")}
          </button>
        </div>
      ) : (
        <div className="value-cell">
          <div
            className={`value-editor${empty ? " empty" : ""}`}
            onFocus={keepRevealActive}
            onPointerDown={keepRevealActive}
            onWheel={keepRevealActive}
          >
            {revealed !== null ? (
              <textarea
                ref={revealedValueRef}
                className="revealed-value-field"
                value={value}
                aria-label={t("row.valueLabel", { key: variable.key })}
                rows={1}
                onKeyDown={onFieldKeyDown}
                onChange={(event) => {
                  onDraftChange(event.target.value);
                  setRevealed(event.target.value);
                  keepRevealActive();
                }}
              />
            ) : (
              <input
                type="password"
                value={value}
                placeholder={placeholder}
                aria-label={t("row.valueLabel", { key: variable.key })}
                onKeyDown={onFieldKeyDown}
                onFocus={onSelect}
                onChange={(event) => onDraftChange(event.target.value)}
              />
            )}
            <button
              type="button"
              className="icon-button"
              title={revealed === null ? t("row.reveal") : t("row.hide")}
              aria-label={revealed === null ? t("row.reveal") : t("row.hide")}
              aria-pressed={revealed !== null}
              disabled={empty}
              onClick={toggleReveal}
            >
              {revealed === null ? <EyeIcon /> : <EyeOffIcon />}
            </button>
            {!hidden && (
              <CopyButton
                className="icon-button"
                label={t("row.copyValue")}
                copiedHint={t("row.clipboardClears", { seconds: CLIPBOARD_CLEAR_SECONDS })}
                disabled={empty || dirty}
                onCopy={() => api.copyValue(projectId, file, variable.key)}
              />
            )}
          </div>
          {dirty && (
            <div className="pending-line">
              <span className="pending-chip replace">{t("row.pendingReplace")}</span>
              {variable.linkedCount > 1 && (
                <span className="pending-impact">{t("row.savedTogether", { count: variable.linkedCount })}</span>
              )}
              <button type="button" className="text-action" onClick={onRevert}>{t("row.revert")}</button>
            </div>
          )}
        </div>
      )}

      <div className="access-cell">
        <select
          className={`access-select ${variable.codexAccess}`}
          value={variable.codexAccess}
          aria-label={t("row.aiAccess", { key: variable.key })}
          onChange={(event) => void changeAccess(event.target.value as CodexAccess)}
        >
          <option value="protected">{t("row.protected")}</option>
          <option value="unclassified">{t("row.unclassified")}</option>
          <option value="read-write">{t("row.readWrite")}</option>
        </select>
      </div>

      <div className="links-cell">
        {variable.linkedCount > 1 ? (
          <span className="links-count" title={variable.linkedFiles.join(" · ")}>
            <LinkIcon />
            {t("row.filesLinked", { count: variable.linkedCount })}
          </span>
        ) : unlinkedPeers ? (
          <span className="links-available">{t("row.sameVariable", { count: sameKeyFiles.length })}</span>
        ) : (
          <span className="links-none" aria-label={t("row.notLinked")}>—</span>
        )}
      </div>
      {dialog}
    </article>
  );
}
