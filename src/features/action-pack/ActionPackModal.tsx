import "./ActionPackModal.css";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useConfirm } from "../../components/ConfirmDialog";
import { Modal } from "../../components/Modal";
import { CloseIcon, LockIcon, PlusIcon } from "../../components/icons";
import { localizeError, useI18n } from "../../i18n";
import * as api from "../../lib/api";
import { ActionBodyEditor, parseBodyJson, type BodyMode } from "./ActionBodyEditor";
import { ActionResponsePanel, type ResponseTab } from "./ActionResponsePanel";
import type {
  ActionExecutionResult,
  ActionPackInfo,
  ActionRunRecord,
  OccurrenceProjection,
  ProjectProjection,
  SavedActionRequest,
} from "../../lib/types";

interface Props {
  projectId: string;
  projection: ProjectProjection;
  onClose: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}

type RequestTab = "headers" | "body";

/**
 * A request-builder layout for installed Action Packs, with saved requests and run
 * history (ADR-0046). The method, URL and secret headers stay fixed by the Pack
 * (ADR-0019, ADR-0030); a saved request keeps variable names and an allowlisted body
 * that Rust checked for managed values, never a value.
 */
export function ActionPackModal({ projectId, projection, onClose, onError, onNotice }: Props) {
  const { locale, t } = useI18n();
  const { confirm, dialog } = useConfirm();
  const [packs, setPacks] = useState<ActionPackInfo[]>([]);
  const [requests, setRequests] = useState<SavedActionRequest[]>([]);
  const [history, setHistory] = useState<ActionRunRecord[]>([]);
  const [packId, setPackId] = useState("");
  const [file, setFile] = useState(projection.files[0]?.path ?? "");
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [bodyValues, setBodyValues] = useState<Record<string, string>>({});
  const [bodyJson, setBodyJson] = useState("");
  const [bodyMode, setBodyMode] = useState<BodyMode>("fields");
  const [requestTab, setRequestTab] = useState<RequestTab>("headers");
  const [responseTab, setResponseTab] = useState<ResponseTab>("response");
  const [loaded, setLoaded] = useState<SavedActionRequest | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionExecutionResult | ActionRunRecord | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const variablesFor = (path: string) =>
    projection.files.find((candidate) => candidate.path === path)?.groups.flatMap((group) => group.variables) ?? [];
  const variables = useMemo(() => variablesFor(file), [file, projection.files]); // eslint-disable-line react-hooks/exhaustive-deps

  const pack = packs.find((candidate) => candidate.id === packId) ?? null;

  const selectPack = (next: ActionPackInfo | undefined) => {
    setPackId(next?.id ?? "");
    setBindings(next ? defaultBindings(next, variablesFor(file)) : {});
    setBodyValues({});
    setBodyJson("");
    setBodyMode("fields");
    setRequestTab("headers");
    setLoaded(null);
    setNaming(null);
    setResult(null);
  };

  const loadRequest = (saved: SavedActionRequest) => {
    const target = packs.find((candidate) => candidate.id === saved.packId);
    if (!target) return;
    setPackId(target.id);
    setFile(saved.file);
    setBindings({ ...defaultBindings(target, variablesFor(saved.file)), ...saved.bindings });
    setBodyValues(saved.body ? fieldsFromJson(saved.body) : {});
    setBodyJson(saved.body ? prettyJson(saved.body) : "");
    setBodyMode("fields");
    setRequestTab(target.bodyFields.length > 0 ? "body" : "headers");
    setLoaded(saved);
    setNaming(null);
    setResult(null);
  };

  const reload = async (preferredPackId?: string) => {
    setLoading(true);
    try {
      const [nextPacks, nextRequests, nextHistory] = await Promise.all([
        api.listActionPacks(projectId),
        api.listActionRequests(projectId),
        api.listActionHistory(projectId),
      ]);
      setPacks(nextPacks);
      setRequests(nextRequests);
      setHistory(nextHistory);
      const keep = nextPacks.find((candidate) => candidate.id === (preferredPackId ?? packId));
      if (!keep || preferredPackId) selectPack(keep ?? nextPacks[0]);
    } catch (error) {
      onError(localizeError(error, locale, "action.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const namingOpen = naming !== null;
  useEffect(() => {
    if (namingOpen) nameInputRef.current?.select();
  }, [namingOpen]);

  const changeFile = (path: string) => {
    setFile(path);
    if (!pack) return;
    const nextVariables = variablesFor(path);
    setBindings((current) => Object.fromEntries(pack.bindings.map((binding) => {
      const chosen = current[binding.id];
      const stillPresent = nextVariables.some((variable) => variable.key === chosen && variable.valueState === "present");
      return [binding.id, stillPresent ? chosen! : suggestVariable(binding, nextVariables)];
    })));
  };

  const body = bodyMode === "json"
    ? parseBodyJson(bodyJson, pack?.bodyFields ?? [])
    : { value: buildBody(pack?.bodyFields ?? [], bodyValues), error: null };
  const bindingsReady = Boolean(pack?.available) && pack!.bindings.every((binding) =>
    variables.some((variable) => variable.key === bindings[binding.id] && variable.valueState === "present"));
  const ready = bindingsReady && (pack!.bodyFields.length === 0 || body.value !== undefined);
  const dirty = loaded !== null && (
    loaded.file !== file
    || JSON.stringify(sortKeys(loaded.bindings)) !== JSON.stringify(sortKeys(bindings))
    || normalizeJson(loaded.body) !== normalizeJson(body.value)
  );

  const switchBodyMode = (mode: BodyMode) => {
    if (mode === bodyMode) return;
    if (mode === "json") {
      setBodyJson(prettyJson(buildBody(pack?.bodyFields ?? [], bodyValues) ?? "{}"));
    } else {
      if (body.error) return;
      setBodyValues(body.value ? fieldsFromJson(body.value) : {});
    }
    setBodyMode(mode);
  };

  const executionRequest = () => ({
    packId: pack!.id,
    file,
    bindings,
    ...(body.value !== undefined ? { body: body.value } : {}),
  });

  const run = async () => {
    if (!pack || !ready || busy) return;
    setBusy(true);
    setResult(null);
    setResponseTab("response");
    try {
      setResult(await api.executeActionPack(projectId, executionRequest(), loaded?.name));
      setHistory(await api.listActionHistory(projectId));
    } catch (error) {
      onError(localizeError(error, locale, "action.error"));
    } finally {
      setBusy(false);
    }
  };

  const save = async (name: string, asNew: boolean) => {
    if (!pack || !bindingsReady || body.error || busy) return;
    setBusy(true);
    try {
      const saved = await api.saveActionRequest(projectId, {
        ...(loaded && !asNew ? { id: loaded.id } : {}),
        name,
        request: executionRequest(),
      });
      setRequests(await api.listActionRequests(projectId));
      setLoaded(saved);
      setNaming(null);
      onNotice(t("action.saved", { name: saved.name }));
    } catch (error) {
      onError(localizeError(error, locale, "action.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const requestSave = () => {
    if (loaded) void save(loaded.name, false);
    else setNaming(pack ? t("action.defaultRequestName", { name: pack.displayName }) : "");
  };

  const removeRequest = async (saved: SavedActionRequest) => {
    const confirmed = await confirm({
      title: t("action.deleteRequestConfirm", { name: saved.name }),
      confirmLabel: t("common.remove"),
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await api.deleteActionRequest(projectId, saved.id);
      setRequests(await api.listActionRequests(projectId));
      if (loaded?.id === saved.id) setLoaded(null);
    } catch (error) {
      onError(localizeError(error, locale, "action.saveError"));
    }
  };

  const install = async () => {
    setBusy(true);
    try {
      const installed = await api.chooseAndInstallActionPack(t("action.installDialog"));
      if (installed) {
        onNotice(t("action.installed", { name: installed.displayName }));
        await reload(installed.id);
      }
    } catch (error) {
      onError(localizeError(error, locale, "action.installError"));
    } finally {
      setBusy(false);
    }
  };

  const removePack = async (target: ActionPackInfo) => {
    const confirmed = await confirm({
      title: t("action.removeConfirm", { name: target.displayName }),
      confirmLabel: t("common.remove"),
      tone: "danger",
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await api.removeActionPack(target.id);
      onNotice(t("action.removed", { name: target.displayName }));
      await reload();
    } catch (error) {
      onError(localizeError(error, locale, "action.removeError"));
    } finally {
      setBusy(false);
    }
  };

  const clearHistory = async () => {
    try {
      await api.clearActionHistory(projectId);
      setHistory([]);
    } catch (error) {
      onError(localizeError(error, locale, "action.error"));
    }
  };

  const copyOutput = async () => {
    if (!result) return;
    const payload = {
      status: result.statusCode,
      durationMs: result.durationMs,
      resultCode: result.resultCode,
      output: result.output ?? {},
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      onNotice(t("action.copied"));
    } catch {
      onError(t("common.copyFailed"));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key === "Enter") {
      event.preventDefault();
      void run();
    } else if (command && event.key.toLowerCase() === "s") {
      event.preventDefault();
      requestSave();
    }
  };

  const isCli = pack?.kind === "cli";
  const packName = (id: string) => packs.find((candidate) => candidate.id === id)?.displayName ?? id;

  return (
    <>
    <Modal className="action-pack-modal" title={t("action.title")} description={t("action.description")} onClose={onClose}>
      <div className="action-layout" onKeyDown={onKeyDown}>
        <nav className="action-list" aria-label={t("action.pack")}>
          {packs.map((item) => {
            const saved = requests.filter((request) => request.packId === item.id);
            return (
              <div key={item.id} className="action-group">
                <div className={`action-list-item${item.id === packId && !loaded ? " active" : ""}`}>
                  <button
                    type="button"
                    aria-current={item.id === packId && !loaded ? "true" : undefined}
                    onClick={() => selectPack(item)}
                  >
                    <span className={`action-method ${methodTone(item)}`}>{item.kind === "cli" ? "CLI" : item.method}</span>
                    <span className="action-list-name">{item.displayName}</span>
                  </button>
                  <button
                    type="button"
                    className="action-list-remove"
                    aria-label={t("action.removeNamed", { name: item.displayName })}
                    title={t("action.removeNamed", { name: item.displayName })}
                    disabled={busy}
                    onClick={() => void removePack(item)}
                  >
                    <CloseIcon />
                  </button>
                </div>
                {saved.map((request) => (
                  <div key={request.id} className={`action-list-item saved${loaded?.id === request.id ? " active" : ""}`}>
                    <button
                      type="button"
                      aria-current={loaded?.id === request.id ? "true" : undefined}
                      onClick={() => loadRequest(request)}
                    >
                      <span className="action-list-name">{request.name}</span>
                    </button>
                    <button
                      type="button"
                      className="action-list-remove"
                      aria-label={t("action.deleteRequest", { name: request.name })}
                      title={t("action.deleteRequest", { name: request.name })}
                      onClick={() => void removeRequest(request)}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
          <button type="button" className="action-list-install" disabled={busy} onClick={() => void install()}>
            <PlusIcon /> {t("action.install")}
          </button>
        </nav>

        <div className="action-main">
          {loading && packs.length === 0 ? (
            <div className="action-empty"><span className="spinner" />{t("action.loading")}</div>
          ) : !pack ? (
            <div className="action-empty">
              <strong>{t("action.emptyTitle")}</strong>
              <p>{t("action.emptyBody")}</p>
            </div>
          ) : (
            <>
              <div className="action-title-row">
                {naming !== null ? (
                  <form
                    className="action-name-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (naming.trim()) void save(naming, true);
                    }}
                  >
                    <input
                      ref={nameInputRef}
                      aria-label={t("action.requestName")}
                      value={naming}
                      maxLength={80}
                      onChange={(event) => setNaming(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.stopPropagation();
                          setNaming(null);
                        }
                      }}
                    />
                    <button type="submit" className="quiet-button compact" disabled={!naming.trim() || busy}>{t("action.saveConfirm")}</button>
                    <button type="button" className="quiet-button compact" onClick={() => setNaming(null)}>{t("common.cancel")}</button>
                  </form>
                ) : (
                  <>
                    <h3 className="action-request-name">
                      {loaded ? loaded.name : t("action.unsaved")}
                      {dirty && <span className="action-dirty" title={t("action.dirty")} aria-label={t("action.dirty")}>●</span>}
                    </h3>
                    <div className="action-save-actions">
                      {loaded && (
                        <button className="quiet-button compact" disabled={busy} onClick={() => setNaming(`${loaded.name} ${t("action.copySuffix")}`)}>
                          {t("action.saveAsNew")}
                        </button>
                      )}
                      <button
                        className="quiet-button compact"
                        disabled={!bindingsReady || Boolean(body.error) || busy || (loaded !== null && !dirty)}
                        onClick={requestSave}
                      >
                        {t("action.save")} <kbd>⌘S</kbd>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="action-request">
                <span className={`action-method ${methodTone(pack)}`}>{isCli ? "CLI" : pack.method}</span>
                <code className="action-url" title={t("action.fixedTarget")}>{pack.target}</code>
                <button className="primary-button" disabled={!ready || busy} onClick={() => void run()}>
                  {busy ? t("action.running") : t("action.send")}
                  {!busy && <kbd>⌘↵</kbd>}
                </button>
              </div>
              <p className="action-meta">
                {pack.description}
                {pack.cliVersion && <> · {t("action.cliVersion")} {pack.cliVersion}</>}
              </p>

              <div className="action-tabs" role="tablist" aria-label={t("action.requestParts")}>
                <button role="tab" aria-selected={requestTab === "headers"} onClick={() => setRequestTab("headers")}>
                  {isCli ? t("action.input") : t("action.headers")} <small>{pack.bindings.length}</small>
                </button>
                {pack.bodyFields.length > 0 && (
                  <button role="tab" aria-selected={requestTab === "body"} onClick={() => setRequestTab("body")}>
                    {t("action.body")} <small>{pack.bodyFields.length}</small>
                  </button>
                )}
                <label className="action-file">
                  <span>{t("action.file")}</span>
                  <select value={file} onChange={(event) => changeFile(event.target.value)}>
                    {projection.files.map((item) => <option key={item.path} value={item.path}>{item.displayName}</option>)}
                  </select>
                </label>
              </div>

              {requestTab === "headers" || pack.bodyFields.length === 0 ? (
                <div className="action-table" role="tabpanel">
                  {pack.bindings.map((binding) => (
                    <div className="action-row" key={binding.id}>
                      <code className="action-key">{binding.destination}</code>
                      <span className="action-variable">
                        <LockIcon />
                        <select
                          aria-label={t("action.variableFor", { name: binding.destination })}
                          value={bindings[binding.id] ?? ""}
                          onChange={(event) => setBindings((current) => ({ ...current, [binding.id]: event.target.value }))}
                        >
                          <option value="">{t("action.chooseVariable")}</option>
                          {variables.map((variable) => (
                            <option key={variable.key} value={variable.key} disabled={variable.valueState !== "present"}>
                              {`{{${variable.key}}}`}{variable.valueState !== "present" ? ` · ${t("action.emptyValue")}` : ""}
                            </option>
                          ))}
                        </select>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <ActionBodyEditor
                  fields={pack.bodyFields}
                  mode={bodyMode}
                  values={bodyValues}
                  json={bodyJson}
                  error={body.error}
                  onModeChange={switchBodyMode}
                  onValuesChange={setBodyValues}
                  onJsonChange={setBodyJson}
                />
              )}

              <ActionResponsePanel
                tab={responseTab}
                result={result}
                history={history}
                packName={packName}
                onTabChange={setResponseTab}
                onSelectRecord={(record) => {
                  setResult(record);
                  setResponseTab("response");
                }}
                onClearHistory={() => void clearHistory()}
                onCopy={() => void copyOutput()}
              />
            </>
          )}
        </div>
      </div>
      <p className="action-trust"><LockIcon /> {t("action.trustLine")}</p>
    </Modal>
    {dialog}
    </>
  );
}

function methodTone(pack: ActionPackInfo): string {
  if (pack.kind === "cli") return "cli";
  return pack.method === "GET" || pack.method === "HEAD" ? "read" : "write";
}

function defaultBindings(pack: ActionPackInfo, variables: OccurrenceProjection[]): Record<string, string> {
  return Object.fromEntries(pack.bindings.map((binding) => [binding.id, suggestVariable(binding, variables)]));
}

/** Exact name first, then a single variable whose name contains the binding name. */
function suggestVariable(binding: { id: string; destination: string }, variables: OccurrenceProjection[]): string {
  const present = variables.filter((variable) => variable.valueState === "present");
  const exact = present.find((variable) => variable.key === binding.id || variable.key === binding.destination);
  if (exact) return exact.key;
  const needle = binding.id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const partial = present.filter((variable) => variable.key.includes(needle));
  return partial.length === 1 ? partial[0]!.key : "";
}

/** Values that parse as JSON numbers, booleans, arrays or objects are sent as such; anything else as text. */
function buildBody(fields: string[], values: Record<string, string>): string | undefined {
  const entries = fields
    .map((field) => [field, values[field]?.trim() ?? ""] as const)
    .filter(([, value]) => value !== "")
    .map(([field, value]) => [field, parseLiteral(value)] as const);
  return entries.length > 0 ? JSON.stringify(Object.fromEntries(entries)) : undefined;
}

function parseLiteral(value: string): unknown {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "string" ? value : parsed;
  } catch {
    return value;
  }
}

function fieldsFromJson(json: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ]));
  } catch {
    return {};
  }
}

function prettyJson(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function normalizeJson(json: string | undefined): string {
  if (!json) return "";
  try {
    return JSON.stringify(sortKeys(JSON.parse(json) as Record<string, unknown>));
  } catch {
    return json;
  }
}

function sortKeys<T>(value: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}
