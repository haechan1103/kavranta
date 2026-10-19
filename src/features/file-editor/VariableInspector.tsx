import "./VariableInspector.css";
import { useEffect, useState } from "react";

import { useConfirm } from "../../components/ConfirmDialog";
import { CloseIcon } from "../../components/icons";
import { displayGroupName, useI18n } from "../../i18n";
import * as api from "../../lib/api";
import type { AgentActivityEvent, OccurrenceProjection } from "../../lib/types";
import { categoryKey } from "../activity/AgentActivity";
import { agentDisplayName } from "../integrations/AgentBrandMark";
import { MoveVariableModal } from "./MoveVariableModal";
import { VariableGuideModal } from "./VariableGuideModal";

interface Props {
  projectId: string;
  file: string;
  variable: OccurrenceProjection;
  sameKeyFiles: string[];
  currentGroup: string;
  groups: string[];
  pendingRemoval: boolean;
  onStageRemoval: () => void;
  onRestore: () => void;
  onLink: () => void;
  onMutate: (operation: () => Promise<unknown>, success: string) => Promise<void>;
  onClose: () => void;
}

const recentActivityLimit = 3;

/** Details for the selected variable: what changes rarely stays out of the table row. */
export function VariableInspector({
  projectId,
  file,
  variable,
  sameKeyFiles,
  currentGroup,
  groups,
  pendingRemoval,
  onStageRemoval,
  onRestore,
  onLink,
  onMutate,
  onClose,
}: Props) {
  const { t } = useI18n();
  const { confirm, dialog } = useConfirm();
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(variable.description.join("\n"));
  const [moving, setMoving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const recent = useRecentActivity(projectId, variable.key);

  useEffect(() => {
    setDescription(variable.description.join("\n"));
    setEditingDescription(false);
  }, [variable.key, variable.description]);

  const linked = variable.linkId !== null && variable.linkedFiles.length > 1;
  const unlinkedPeerFiles = variable.linkId === null && sameKeyFiles.length > 1 ? sameKeyFiles : [];
  const separateFiles = linked ? sameKeyFiles.filter((path) => !variable.linkedFiles.includes(path)) : [];

  const detach = async () => {
    const linkId = variable.linkId;
    if (!linkId) return;
    const confirmed = await confirm({
      title: t("row.detachConfirmTitle"),
      body: t("row.detachConfirm"),
      confirmLabel: t("row.detachShort"),
    });
    if (!confirmed) return;
    await onMutate(() => api.detachLink(projectId, linkId, file), t("row.detached", { file }));
  };

  return (
    <aside className="variable-inspector" aria-label={t("inspector.label", { key: variable.key })}>
      <header className="inspector-header">
        <div>
          <h3>{variable.key}</h3>
          <span>{t("inspector.group", { group: displayGroupName(currentGroup, t) })}</span>
        </div>
        <button type="button" className="icon-button" aria-label={t("inspector.close")} title={t("inspector.close")} onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <section className="inspector-section">
        <h4>{t("inspector.description")}</h4>
        {editingDescription ? (
          <div className="description-editor">
            <textarea
              aria-label={t("inspector.description")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div>
              <button type="button" className="quiet-button compact" onClick={() => setEditingDescription(false)}>{t("common.cancel")}</button>
              <button
                type="button"
                className="secondary-button compact"
                onClick={() =>
                  void onMutate(
                    () =>
                      api.saveDescription(projectId, {
                        file,
                        key: variable.key,
                        lines: description.trim() ? description.split("\n") : [],
                      }),
                    t("row.descriptionSaved", { key: variable.key }),
                  ).then(() => setEditingDescription(false))
                }
              >
                {t("row.saveDescription")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={`description-button${variable.description.length === 0 ? " muted" : ""}`}
            onClick={() => setEditingDescription(true)}
          >
            {variable.description.length > 0 ? variable.description.join(" ") : t("row.addDescription")}
          </button>
        )}
      </section>

      <section className="inspector-section">
        <h4>{t("inspector.aiAccess")}</h4>
        <p className="inspector-note">{t(accessHelpKey(variable.codexAccess))}</p>
      </section>

      <section className="inspector-section">
        <h4>{t("inspector.together")}</h4>
        {linked ? (
          <>
            <ul className="inspector-files">
              {variable.linkedFiles.map((path) => (
                <li key={path}>
                  <code>{path}</code>
                  {path === file && <small>{t("common.current")}</small>}
                </li>
              ))}
            </ul>
            <p className="inspector-note">{t("inspector.togetherNote", { count: variable.linkedFiles.length })}</p>
            {separateFiles.length > 0 && (
              <p className="inspector-note">{t("row.separate", { files: separateFiles.join(" · ") })}</p>
            )}
            <button type="button" className="quiet-button compact" onClick={() => void detach()}>{t("row.detach")}</button>
          </>
        ) : unlinkedPeerFiles.length > 0 ? (
          <>
            <ul className="inspector-files">
              {unlinkedPeerFiles.map((path) => (
                <li key={path}>
                  <code>{path}</code>
                  {path === file && <small>{t("common.current")}</small>}
                </li>
              ))}
            </ul>
            <p className="inspector-note">{t("row.peersTitle", { count: unlinkedPeerFiles.length })}</p>
            <button type="button" className="secondary-button compact" onClick={onLink}>{t("row.manageTogether")}</button>
          </>
        ) : (
          <p className="inspector-note">{t("row.notLinked")}</p>
        )}
      </section>

      {variable.hasGuide && (
        <section className="inspector-section">
          <h4>{t("inspector.guide")}</h4>
          <button type="button" className="quiet-button compact" onClick={() => setShowGuide(true)}>
            {t("guide.open", { key: variable.key })}
          </button>
        </section>
      )}

      <section className="inspector-section">
        <h4>{t("inspector.recent")}</h4>
        {recent === null ? (
          <p className="inspector-note">{t("inspector.recentLoading")}</p>
        ) : recent.length === 0 ? (
          <p className="inspector-note">{t("inspector.recentEmpty")}</p>
        ) : (
          <ul className="inspector-activity">
            {recent.map((event) => (
              <li key={`${event.timestampMs}:${event.operation}`}>
                <time dateTime={new Date(event.timestampMs).toISOString()}>
                  {new Date(event.timestampMs).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                </time>
                <span>
                  {agentDisplayName(event.actor)} · {t(categoryKey(event.category))}
                  {" · "}
                  <b className={`outcome ${event.outcome}`}>{t(outcomeKey(event.outcome))}</b>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="inspector-actions">
        <button
          type="button"
          className="quiet-button compact"
          disabled={groups.filter((group) => group !== currentGroup).length === 0}
          onClick={() => setMoving(true)}
        >
          {t("row.moveTitle")}
        </button>
        {pendingRemoval ? (
          <button type="button" className="quiet-button compact" onClick={onRestore}>{t("row.restore")}</button>
        ) : (
          <button type="button" className="danger-quiet-button compact" onClick={onStageRemoval}>
            {t("inspector.stageRemoval")}
          </button>
        )}
      </footer>

      {moving && (
        <MoveVariableModal
          variableKey={variable.key}
          currentGroup={currentGroup}
          groups={groups}
          onClose={() => setMoving(false)}
          onMove={(targetGroup) => onMutate(
            () => api.moveVariable(projectId, { file, key: variable.key, targetGroup }),
            t("row.moved", { key: variable.key, group: displayGroupName(targetGroup, t) }),
          )}
        />
      )}
      {showGuide && (
        <VariableGuideModal
          projectId={projectId}
          name={variable.key}
          onClose={() => setShowGuide(false)}
          onError={() => undefined}
        />
      )}
      {dialog}
    </aside>
  );
}

function outcomeKey(outcome: AgentActivityEvent["outcome"]) {
  if (outcome === "allowed") return "activity.outcome.allowed" as const;
  if (outcome === "blocked") return "activity.outcome.blocked" as const;
  return "activity.outcome.failed" as const;
}

function accessHelpKey(access: OccurrenceProjection["codexAccess"]) {
  if (access === "protected") return "inspector.accessProtected" as const;
  if (access === "read-write") return "inspector.accessReadWrite" as const;
  return "inspector.accessUnclassified" as const;
}

/** Up to three recent AI events that name this variable. `null` while loading. */
function useRecentActivity(projectId: string, key: string) {
  const [events, setEvents] = useState<AgentActivityEvent[] | null>(null);
  useEffect(() => {
    let active = true;
    setEvents(null);
    void api
      .listAgentActivity(projectId)
      .then((all) => {
        if (!active) return;
        setEvents(
          all
            .filter((event) => event.variableNames.includes(key))
            .sort((left, right) => right.timestampMs - left.timestampMs)
            .slice(0, recentActivityLimit),
        );
      })
      .catch(() => {
        if (active) setEvents([]);
      });
    return () => {
      active = false;
    };
  }, [projectId, key]);
  return events;
}
