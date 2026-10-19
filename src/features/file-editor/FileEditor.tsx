import "./FileEditor.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useConfirm } from "../../components/ConfirmDialog";
import { Modal } from "../../components/Modal";
import { RenameModal } from "../../components/RenameModal";
import { displayGroupName, localizeError, useI18n } from "../../i18n";
import * as api from "../../lib/api";
import type {
  FileProjection,
  OccurrenceProjection,
  ProjectProjection,
} from "../../lib/types";
import { SaveBar } from "./SaveBar";
import { usePendingChanges } from "./usePendingChanges";
import { VariableInspector } from "./VariableInspector";
import { VariableRow } from "./VariableRow";

interface Props {
  projectId: string;
  projection: ProjectProjection;
  filePath: string;
  initialSearch?: string;
  initialEmptyOnly?: boolean;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  /** Reports how many staged changes would be lost by leaving this file. */
  onPendingChange?: (count: number) => void;
}

type Filter = "all" | "empty" | "pending" | "protected";

interface ExternalChange {
  added: string[];
  removed: string[];
}

const inspectorStorageKey = "kavranta.inspector-open";

export function FileEditor({
  projectId,
  projection,
  filePath,
  initialSearch = "",
  initialEmptyOnly = false,
  onRefresh,
  onError,
  onNotice,
  onPendingChange,
}: Props) {
  const { locale, t } = useI18n();
  const { confirm, dialog } = useConfirm();
  const file = projection.files.find((item) => item.path === filePath);
  const [adding, setAdding] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [linking, setLinking] = useState<OccurrenceProjection | null>(null);
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(initialEmptyOnly ? "empty" : "all");
  const [search, setSearch] = useState(initialSearch);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(readInspectorPreference);
  const [saving, setSaving] = useState(false);
  const [saveGeneration, setSaveGeneration] = useState(0);
  const [externalChange, setExternalChange] = useState<ExternalChange | null>(null);
  const expectingRefresh = useRef(false);
  const editorRef = useRef<HTMLElement>(null);

  const variables = useMemo(
    () => file?.groups.flatMap((group) => group.variables) ?? [],
    [file],
  );
  const pending = usePendingChanges(filePath, variables);

  const occurrenceFilesByKey = useMemo(() => {
    const filesByKey = new Map<string, Set<string>>();
    for (const candidate of projection.files) {
      for (const group of candidate.groups) {
        for (const variable of group.variables) {
          const files = filesByKey.get(variable.key) ?? new Set<string>();
          files.add(candidate.path);
          filesByKey.set(variable.key, files);
        }
      }
    }
    return filesByKey;
  }, [projection.files]);

  const sameKeyFilesFor = useCallback(
    (key: string) => [...(occurrenceFilesByKey.get(key) ?? [filePath])],
    [occurrenceFilesByKey, filePath],
  );

  const linkCandidates = useMemo(() => {
    if (!linking) return [];
    const candidatePaths = new Set(occurrenceFilesByKey.get(linking.key) ?? []);
    return projection.files.filter((candidate) => candidatePaths.has(candidate.path));
  }, [linking, occurrenceFilesByKey, projection.files]);

  useEffect(() => {
    onPendingChange?.(pending.count);
  }, [onPendingChange, pending.count]);

  useEffect(() => () => onPendingChange?.(0), [onPendingChange]);

  // A refresh this editor did not cause is an external change. Keep the drafts and say so.
  const structure = useMemo(() => variables.map((variable) => variable.key), [variables]);
  const previousStructure = useRef(structure);
  useEffect(() => {
    const before = previousStructure.current;
    previousStructure.current = structure;
    if (before === structure) return;
    if (expectingRefresh.current) {
      expectingRefresh.current = false;
      return;
    }
    if (pending.count === 0) return;
    const added = structure.filter((key) => !before.includes(key));
    const removed = before.filter((key) => !structure.includes(key));
    setExternalChange({ added, removed });
  }, [structure, pending.count]);

  const counts = useMemo(() => ({
    all: variables.length,
    empty: variables.filter((variable) => variable.valueState === "empty").length,
    pending: pending.count,
    protected: variables.filter((variable) => variable.codexAccess === "protected").length,
  }), [variables, pending.count]);

  const matches = useCallback((variable: OccurrenceProjection, groupName: string) => {
    const query = search.trim().toLocaleLowerCase();
    const passesFilter =
      filter === "all" ||
      (filter === "empty" && variable.valueState === "empty") ||
      (filter === "pending" && (pending.drafts.has(variable.key) || pending.removals.has(variable.key))) ||
      (filter === "protected" && variable.codexAccess === "protected");
    return passesFilter && (!query || [variable.key, groupName, ...variable.description]
      .some((text) => text.toLocaleLowerCase().includes(query)));
  }, [filter, search, pending.drafts, pending.removals]);

  const visibleKeys = useMemo(() => {
    const keys: string[] = [];
    for (const group of file?.groups ?? []) {
      if (collapsed.has(group.name)) continue;
      for (const variable of group.variables) {
        if (matches(variable, group.name)) keys.push(variable.key);
      }
    }
    return keys;
  }, [file, collapsed, matches]);

  const selected = variables.find((variable) => variable.key === selectedKey) ?? null;
  const selectedGroup = file?.groups.find((group) => group.variables.some((variable) => variable.key === selectedKey));

  const mutate = useCallback(async (operation: () => Promise<unknown>, success: string) => {
    try {
      expectingRefresh.current = true;
      await operation();
      await onRefresh();
      onNotice(success);
    } catch (cause) {
      expectingRefresh.current = false;
      onError(localizeError(cause, locale, "error.mutation"));
    }
  }, [locale, onError, onNotice, onRefresh]);

  const save = useCallback(async () => {
    if (saving || pending.count === 0) return;
    const savable = pending.changes.filter((change) => !pending.orphaned.includes(change.key));
    const removals = savable.filter((change) => change.kind === "remove");
    if (removals.length > 0) {
      const confirmed = await confirm({
        title: t("save.removeConfirmTitle", { count: removals.length }),
        body: removals
          .map((change) => {
            const variable = variables.find((candidate) => candidate.key === change.key);
            return variable && variable.linkedCount > 1
              ? t("save.removeLinkedLine", { key: change.key, count: variable.linkedCount - 1 })
              : change.key;
          })
          .join(" · "),
        confirmLabel: t("save.removeConfirmAction", { count: removals.length }),
        tone: "danger",
      });
      if (!confirmed) return;
    }

    setSaving(true);
    expectingRefresh.current = true;
    const failed: string[] = [];
    let saved = 0;
    for (const change of savable) {
      try {
        if (change.kind === "replace") {
          await api.saveValue(projectId, { file: filePath, key: change.key, newValue: pending.drafts.get(change.key) ?? "" });
        } else {
          await api.deleteVariable(projectId, { file: filePath, key: change.key });
        }
        pending.revert(change.key);
        saved += 1;
      } catch {
        failed.push(change.key);
      }
    }
    try {
      await onRefresh();
    } catch (cause) {
      onError(localizeError(cause, locale, "error.rescan"));
    }
    setSaveGeneration((generation) => generation + 1);
    setSaving(false);
    setExternalChange(null);
    const files = new Set(savable.filter((change) => !failed.includes(change.key)).flatMap((change) => change.files));
    if (failed.length > 0) {
      onError(t("save.partialFailure", { saved, keys: failed.join(", ") }));
    } else {
      onNotice(t("save.saved", { count: saved, files: files.size }));
    }
  }, [confirm, filePath, locale, onError, onNotice, onRefresh, pending, projectId, saving, t, variables]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector("[role='dialog']")) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
        return;
      }
      if (command && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setInspectorOpen((open) => writeInspectorPreference(!open));
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (visibleKeys.length === 0) return;
        event.preventDefault();
        const index = selectedKey ? visibleKeys.indexOf(selectedKey) : -1;
        const next = event.key === "ArrowDown"
          ? visibleKeys[Math.min(visibleKeys.length - 1, index + 1)]
          : visibleKeys[Math.max(0, index - 1)];
        if (!next) return;
        setSelectedKey(next);
        editorRef.current
          ?.querySelector<HTMLElement>(`[data-variable-key="${CSS.escape(next)}"] .key-button`)
          ?.focus();
        return;
      }
      if (event.key === "Enter" && selectedKey && target?.classList.contains("key-button")) {
        event.preventDefault();
        editorRef.current
          ?.querySelector<HTMLElement>(`[data-variable-key="${CSS.escape(selectedKey)}"] .value-editor input, [data-variable-key="${CSS.escape(selectedKey)}"] .value-editor textarea`)
          ?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [save, selectedKey, visibleKeys]);

  if (!file) {
    return (
      <section className="center-state">
        <p>{t("file.missing")}</p>
      </section>
    );
  }

  const filtering = filter !== "all" || Boolean(search.trim());
  const visibleCount = file.groups.reduce(
    (total, group) => total + group.variables.filter((variable) => matches(variable, group.name)).length,
    0,
  );
  const groupNames = file.groups.map((item) => item.name);
  const visibleChecked = [...checked].filter((key) => variables.some((variable) => variable.key === key));
  const allVisibleChecked = visibleKeys.length > 0 && visibleKeys.every((key) => checked.has(key));
  const showInspector = inspectorOpen && selected !== null && selectedGroup !== undefined;

  const select = (key: string) => {
    setSelectedKey(key);
  };

  const toggleCheck = (key: string, value: boolean) => {
    setChecked((current) => {
      const next = new Set(current);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  return (
    <section className={`file-editor${showInspector ? " with-inspector" : ""}`} ref={editorRef}>
      <div className="file-editor-main">
        <div className="file-heading">
          <div>
            <h2>{file.displayName}</h2>
            {file.displayName !== file.path && <code className="file-physical-path">{file.path}</code>}
            <p>{t("file.summary", { variables: variables.length, groups: file.groups.length })}</p>
          </div>
          <div className="header-actions">
            <button className="quiet-button" onClick={() => setAddingGroup(true)}>{t("file.newGroup")}</button>
            <button className="primary-button" onClick={() => setAdding(file.groups[0]?.name ?? "기타")}>{t("file.newVariable")}</button>
          </div>
        </div>

        {file.warnings.length > 0 && (
          <div className="warning-banner">
            <strong>{t("file.warningTitle")}</strong>
            <span>{localizedWarnings(file.warnings, locale, t)}</span>
          </div>
        )}

        {externalChange && (
          <div className="external-change-banner" role="alert">
            <div>
              <strong>{t("file.externalTitle")}</strong>
              <span>
                {[
                  externalChange.added.length > 0 ? t("file.externalAdded", { keys: externalChange.added.join(", ") }) : null,
                  externalChange.removed.length > 0 ? t("file.externalRemoved", { keys: externalChange.removed.join(", ") }) : null,
                  t("file.externalKept", { count: pending.count }),
                ].filter(Boolean).join(" ")}
              </span>
            </div>
            <button className="quiet-button compact" onClick={() => setExternalChange(null)}>{t("file.externalDismiss")}</button>
          </div>
        )}

        {variables.length > 0 && (
          visibleChecked.length > 0 ? (
            <div className="bulk-bar" role="toolbar" aria-label={t("file.bulkLabel")}>
              <strong>{t("file.bulkSelected", { count: visibleChecked.length })}</strong>
              <button
                className="bulk-action"
                onClick={() => {
                  pending.stageRemoval(visibleChecked);
                  setChecked(new Set());
                }}
              >
                {t("inspector.stageRemoval")}
              </button>
              <button className="bulk-action quiet" onClick={() => setChecked(new Set())}>{t("file.bulkClear")}</button>
            </div>
          ) : (
            <div className="file-filter-bar" role="toolbar" aria-label={t("file.filters")}>
              <input
                type="search"
                className="file-search"
                aria-label={t("file.search")}
                placeholder={t("file.search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="filter-chips" role="group" aria-label={t("file.filters")}>
                {(["all", "empty", "pending", "protected"] as const).map((value) => (
                  <button
                    key={value}
                    className={`filter-chip${filter === value ? " active" : ""}`}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {t(filterLabelKey(value))}
                    <small>{counts[value]}</small>
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {filtering && visibleCount === 0 && (
          <div className="file-filter-empty">
            <strong>{t(search.trim() ? "file.noSearchResults" : filter === "empty" ? "file.noEmptyVariables" : "file.noFilterResults")}</strong>
            <span>{t(search.trim() ? "file.noSearchResultsBody" : filter === "empty" ? "file.noEmptyVariablesBody" : "file.noFilterResultsBody")}</span>
          </div>
        )}

        <div className="variables-table" hidden={filtering && visibleCount === 0}>
          <div className="variables-table-head">
            <span className="row-check">
              <input
                type="checkbox"
                aria-label={t("file.selectAll")}
                checked={allVisibleChecked}
                onChange={(event) => setChecked(event.target.checked ? new Set(visibleKeys) : new Set())}
              />
            </span>
            <span>{t("file.columnKey")}</span>
            <span>{t("file.columnValue")}</span>
            <span>{t("file.columnAccess")}</span>
            <span>{t("file.columnLinks")}</span>
          </div>
          {file.groups.map((group, groupIndex) => {
            const groupVisible = group.variables.filter((variable) => matches(variable, group.name));
            const isCollapsed = collapsed.has(group.name);
            const name = displayGroupName(group.name, t);
            return (
              <section
                className="group-block"
                hidden={filtering && groupVisible.length === 0}
                key={`${group.name}:${groupIndex}`}
              >
                <header className="group-header">
                  <button
                    className="group-toggle"
                    aria-expanded={!isCollapsed}
                    onClick={() => setCollapsed((current) => {
                      const next = new Set(current);
                      if (isCollapsed) next.delete(group.name);
                      else next.add(group.name);
                      return next;
                    })}
                  >
                    <svg className="group-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5" /></svg>
                    <h3>{name}</h3>
                    <span>{filtering ? groupVisible.length : group.variables.length}</span>
                  </button>
                  <div className="group-actions">
                    <button className="group-action" onClick={() => setAdding(group.name)}>
                      {t("file.addToGroup", { name })}
                    </button>
                    {group.name !== "기타" && (
                      <button
                        className="group-action"
                        aria-label={t("file.renameGroupNamed", { name })}
                        onClick={() => setRenamingGroup(group.name)}
                      >
                        {t("file.renameGroup")}
                      </button>
                    )}
                  </div>
                </header>
                {group.variables.length === 0 && !isCollapsed && (
                  <div className="empty-group-row">{t("file.emptyGroup")}</div>
                )}
                {group.variables.map((variable) => (
                  <VariableRow
                    key={variable.key}
                    hidden={isCollapsed || !matches(variable, group.name)}
                    projectId={projectId}
                    file={file.path}
                    variable={variable}
                    sameKeyFiles={sameKeyFilesFor(variable.key)}
                    draft={pending.drafts.get(variable.key)}
                    pendingRemoval={pending.removals.has(variable.key)}
                    selected={selectedKey === variable.key}
                    checked={checked.has(variable.key)}
                    saveGeneration={saveGeneration}
                    onSelect={() => select(variable.key)}
                    onCheck={(value) => toggleCheck(variable.key, value)}
                    onDraftChange={(value) => pending.setDraft(variable.key, value)}
                    onRevert={() => pending.revert(variable.key)}
                    onMutate={mutate}
                  />
                ))}
              </section>
            );
          })}
        </div>

        <p className="file-keyboard-hint">{t("file.keyboardHint")}</p>

        <SaveBar
          changes={pending.changes}
          orphaned={pending.orphaned}
          saving={saving}
          onRevert={pending.revert}
          onRevertAll={pending.revertAll}
          onSave={() => void save()}
        />
      </div>

      {showInspector && selected && selectedGroup && (
        <VariableInspector
          projectId={projectId}
          file={file.path}
          variable={selected}
          sameKeyFiles={sameKeyFilesFor(selected.key)}
          currentGroup={selectedGroup.name}
          groups={groupNames}
          pendingRemoval={pending.removals.has(selected.key)}
          onStageRemoval={() => pending.stageRemoval([selected.key])}
          onRestore={() => pending.revert(selected.key)}
          onLink={() => setLinking(selected)}
          onMutate={mutate}
          onClose={() => setInspectorOpen(writeInspectorPreference(false))}
        />
      )}
      {!inspectorOpen && selected && (
        <button className="inspector-reopen quiet-button compact" onClick={() => setInspectorOpen(writeInspectorPreference(true))}>
          {t("inspector.open")} <kbd>⌘I</kbd>
        </button>
      )}

      {adding !== null && (
        <AddVariableModal
          file={file}
          initialGroup={adding}
          onClose={() => setAdding(null)}
          onSubmit={(request) => {
            void mutate(
              () => api.addVariable(projectId, { file: file.path, ...request }),
              t("file.variableAdded", { key: request.key }),
            ).then(() => {
              setAdding(null);
              setSelectedKey(request.key);
            });
          }}
        />
      )}

      {addingGroup && (
        <CreateGroupModal
          file={file.path}
          onClose={() => setAddingGroup(false)}
          onSubmit={(name) => {
            void mutate(
              () => api.createGroup(projectId, { file: file.path, name }),
              t("file.groupCreated", { name }),
            ).then(() => setAddingGroup(false));
          }}
        />
      )}

      {linking && (
        <LinkModal
          currentFile={file.path}
          variable={linking}
          candidates={linkCandidates}
          onClose={() => setLinking(null)}
          onSubmit={(files) => {
            void mutate(
              () =>
                api.createLink(projectId, {
                  key: linking.key,
                  files,
                  sourceFile: file.path,
                }),
              t("file.variablesLinked", { key: linking.key, count: files.length }),
            ).then(() => setLinking(null));
          }}
        />
      )}

      {renamingGroup && (
        <RenameModal
          title={t("file.renameGroupPrompt")}
          currentName={renamingGroup}
          onClose={() => setRenamingGroup(null)}
          onRename={(name) => {
            const currentName = renamingGroup;
            void mutate(
              () => api.renameGroup(projectId, {
                file: file.path,
                currentName,
                newName: name,
              }),
              t("file.groupRenamed"),
            );
          }}
        />
      )}
      {dialog}
    </section>
  );
}

function filterLabelKey(filter: Filter) {
  if (filter === "empty") return "file.filterEmpty" as const;
  if (filter === "pending") return "file.filterPending" as const;
  if (filter === "protected") return "file.filterProtected" as const;
  return "file.filterAll" as const;
}

function readInspectorPreference() {
  try {
    return window.localStorage.getItem(inspectorStorageKey) !== "closed";
  } catch {
    return true;
  }
}

function writeInspectorPreference(open: boolean) {
  try {
    window.localStorage.setItem(inspectorStorageKey, open ? "open" : "closed");
  } catch {
    // A preference that cannot be stored still applies for this session.
  }
  return open;
}

function CreateGroupModal({
  file,
  onClose,
  onSubmit,
}: {
  file: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  return (
    <Modal
      title={t("group.newTitle")}
      description={t("group.newDescription", { file })}
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          onSubmit(trimmed);
        }}
      >
        <label>
          {t("group.name")}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="GPT"
            autoFocus
          />
        </label>
        <div className="impact-note">
          <strong>{t("group.preserveTitle")}</strong>
          <span>{t("group.preserveBody")}</span>
        </div>
        <div className="modal-actions">
          <button type="button" className="quiet-button" onClick={onClose}>{t("common.cancel")}</button>
          <button className="primary-button" disabled={!name.trim()}>{t("group.create")}</button>
        </div>
      </form>
    </Modal>
  );
}

function AddVariableModal({
  file,
  initialGroup,
  onClose,
  onSubmit,
}: {
  file: FileProjection;
  initialGroup: string;
  onClose: () => void;
  onSubmit: (request: {
    key: string;
    group: string;
    description: string[];
    value: string;
  }) => void;
}) {
  const { t } = useI18n();
  const [key, setKey] = useState("");
  const [group, setGroup] = useState(initialGroup);
  const [newGroup, setNewGroup] = useState("");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  return (
    <Modal
      title={t("variable.newTitle")}
      description={t("variable.newDescription", { file: file.path })}
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!key.trim()) return;
          const targetGroup = group === "__new_group__" ? newGroup.trim() : group;
          if (!targetGroup) return;
          onSubmit({
            key: key.trim().toUpperCase(),
            group: targetGroup,
            description: description.trim() ? description.split("\n") : [],
            value,
          });
        }}
      >
        <label>{t("variable.name")}<input value={key} onChange={(event) => setKey(event.target.value)} placeholder="NEW_VARIABLE" autoFocus /></label>
        <label>{t("variable.group")}
          <select value={group} onChange={(event) => setGroup(event.target.value)}>
            {file.groups.map((item) => <option key={item.name} value={item.name}>{displayGroupName(item.name, t)}</option>)}
            {!file.groups.some((item) => item.name === "기타") && <option value="기타">{t("group.ungroupedOption")}</option>}
            <option value="__new_group__">{t("variable.createGroup")}</option>
          </select>
        </label>
        {group === "__new_group__" && (
          <label>{t("variable.newGroupName")}<input value={newGroup} onChange={(event) => setNewGroup(event.target.value)} placeholder="GPT" /></label>
        )}
        <label>{t("variable.description")}<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("variable.descriptionPlaceholder")} /></label>
        <label>{t("variable.value")} <span className="label-hint">{t("common.optional")}</span><input type="password" value={value} onChange={(event) => setValue(event.target.value)} placeholder={t("variable.valueLater")} /></label>
        <div className="modal-actions"><button type="button" className="quiet-button" onClick={onClose}>{t("common.cancel")}</button><button className="primary-button">{t("variable.add")}</button></div>
      </form>
    </Modal>
  );
}

function LinkModal({
  currentFile,
  variable,
  candidates,
  onClose,
  onSubmit,
}: {
  currentFile: string;
  variable: OccurrenceProjection;
  candidates: FileProjection[];
  onClose: () => void;
  onSubmit: (files: string[]) => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set([currentFile]));
  return (
    <Modal
      title={t("link.title", { key: variable.key })}
      description={t("link.description")}
      onClose={onClose}
    >
      <div className="link-list">
        {candidates.map((candidate) => (
          <label key={candidate.path}>
            <input
              type="checkbox"
              checked={selected.has(candidate.path)}
              disabled={candidate.path === currentFile}
              onChange={(event) => {
                setSelected((current) => {
                  const next = new Set(current);
                  if (event.target.checked) next.add(candidate.path);
                  else next.delete(candidate.path);
                  return next;
                });
              }}
            />
            <span><strong>{candidate.path}</strong><small>{candidate.path === currentFile ? t("link.source") : t("link.compare")}</small></span>
          </label>
        ))}
      </div>
      <div className="impact-note">
        <strong>{t("link.selection", { key: variable.key, count: selected.size })}</strong>
        <span>{t("link.confirmation")}</span>
      </div>
      <div className="modal-actions"><button className="quiet-button" onClick={onClose}>{t("common.cancel")}</button><button className="primary-button" disabled={selected.size < 2} onClick={() => onSubmit([...selected])}>{t("link.submit", { count: selected.size })}</button></div>
    </Modal>
  );
}

function localizedWarnings(
  warnings: string[],
  locale: "en" | "ko",
  t: ReturnType<typeof useI18n>["t"],
) {
  if (locale === "ko") return warnings.join(" ");
  const translated = warnings.map((warning) => {
    if (warning.includes("알 수 없는 Kavranta 지시문")) {
      return t("file.warningUnknownDirective");
    }
    if (warning.includes("해석하지 못한 줄")) return t("file.warningUnknownLine");
    return null;
  });
  return translated.every(Boolean)
    ? translated.join(" ")
    : t("file.warningCount", { count: warnings.length });
}
