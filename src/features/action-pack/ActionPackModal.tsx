import "./ActionPackModal.css";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

import { useConfirm } from "../../components/ConfirmDialog";
import { Modal } from "../../components/Modal";
import { CloseIcon, LockIcon, PlusIcon } from "../../components/icons";
import { localizeError, useI18n } from "../../i18n";
import * as api from "../../lib/api";
import type {
  ActionExecutionResult,
  ActionPackInfo,
  OccurrenceProjection,
  ProjectProjection,
} from "../../lib/types";

interface Props {
  projectId: string;
  projection: ProjectProjection;
  onClose: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}

type Tab = "headers" | "body";

/**
 * A request-builder layout for installed Action Packs. The method, URL and secret
 * headers stay fixed by the Pack (ADR-0019, ADR-0030); the user only picks which
 * managed variable fills each header and types allowlisted body fields.
 */
export function ActionPackModal({ projectId, projection, onClose, onError, onNotice }: Props) {
  const { locale, t } = useI18n();
  const { confirm, dialog } = useConfirm();
  const [packs, setPacks] = useState<ActionPackInfo[]>([]);
  const [packId, setPackId] = useState("");
  const [file, setFile] = useState(projection.files[0]?.path ?? "");
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [bodyValues, setBodyValues] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("headers");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionExecutionResult | null>(null);

  const load = async (preferredId?: string) => {
    setLoading(true);
    try {
      const next = await api.listActionPacks(projectId);
      setPacks(next);
      setPackId((current) => {
        const preferred = preferredId ?? current;
        return next.some((pack) => pack.id === preferred) ? preferred : (next[0]?.id ?? "");
      });
    } catch (error) {
      onError(localizeError(error, locale, "action.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const pack = packs.find((candidate) => candidate.id === packId) ?? null;
  const variables = useMemo(
    () => projection.files
      .find((candidate) => candidate.path === file)
      ?.groups.flatMap((group) => group.variables) ?? [],
    [file, projection.files],
  );

  useEffect(() => {
    if (!pack) {
      setBindings({});
      return;
    }
    setBindings(Object.fromEntries(pack.bindings.map((binding) => [binding.id, suggestVariable(binding, variables)])));
    setBodyValues({});
    setTab("headers");
    setResult(null);
  }, [pack, variables]);

  const body = buildBody(pack?.bodyFields ?? [], bodyValues);
  const ready = Boolean(pack?.available)
    && pack!.bindings.every((binding) => {
      const selected = bindings[binding.id];
      return variables.some((variable) => variable.key === selected && variable.valueState === "present");
    })
    && (pack!.bodyFields.length === 0 || body !== undefined);

  const install = async () => {
    setBusy(true);
    try {
      const installed = await api.chooseAndInstallActionPack(t("action.installDialog"));
      if (installed) {
        onNotice(t("action.installed", { name: installed.displayName }));
        await load(installed.id);
      }
    } catch (error) {
      onError(localizeError(error, locale, "action.installError"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (target: ActionPackInfo) => {
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
      await load();
    } catch (error) {
      onError(localizeError(error, locale, "action.removeError"));
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!pack || !ready || busy) return;
    setBusy(true);
    setResult(null);
    try {
      setResult(await api.executeActionPack(projectId, {
        packId: pack.id,
        file,
        bindings,
        ...(body !== undefined ? { body } : {}),
      }));
    } catch (error) {
      onError(localizeError(error, locale, "action.error"));
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void run();
    }
  };

  const isCli = pack?.kind === "cli";

  return (
    <>
    <Modal className="action-pack-modal" title={t("action.title")} description={t("action.description")} onClose={onClose}>
      <div className="action-layout" onKeyDown={onKeyDown}>
        <nav className="action-list" aria-label={t("action.pack")}>
          {packs.map((item) => (
            <div key={item.id} className={`action-list-item${item.id === packId ? " active" : ""}`}>
              <button
                type="button"
                aria-current={item.id === packId ? "true" : undefined}
                onClick={() => setPackId(item.id)}
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
                onClick={() => void remove(item)}
              >
                <CloseIcon />
              </button>
            </div>
          ))}
          <button type="button" className="action-list-install" disabled={busy} onClick={() => void install()}>
            <PlusIcon /> {t("action.install")}
          </button>
        </nav>

        <div className="action-main">
          {loading ? (
            <div className="action-empty"><span className="spinner" />{t("action.loading")}</div>
          ) : !pack ? (
            <div className="action-empty">
              <strong>{t("action.emptyTitle")}</strong>
              <p>{t("action.emptyBody")}</p>
            </div>
          ) : (
            <>
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
                <button role="tab" aria-selected={tab === "headers"} onClick={() => setTab("headers")}>
                  {isCli ? t("action.input") : t("action.headers")} <small>{pack.bindings.length}</small>
                </button>
                {pack.bodyFields.length > 0 && (
                  <button role="tab" aria-selected={tab === "body"} onClick={() => setTab("body")}>
                    {t("action.body")} <small>{pack.bodyFields.length}</small>
                  </button>
                )}
                <label className="action-file">
                  <span>{t("action.file")}</span>
                  <select value={file} onChange={(event) => setFile(event.target.value)}>
                    {projection.files.map((item) => <option key={item.path} value={item.path}>{item.displayName}</option>)}
                  </select>
                </label>
              </div>

              {tab === "headers" || pack.bodyFields.length === 0 ? (
                <div className="action-table" role="tabpanel">
                  {pack.bindings.map((binding) => (
                    <div className="action-row" key={binding.id}>
                      <code className="action-key">{binding.destination === "stdin" ? "stdin" : binding.destination}</code>
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
                <div className="action-table" role="tabpanel">
                  {pack.bodyFields.map((field) => (
                    <div className="action-row" key={field}>
                      <code className="action-key">{field}</code>
                      <input
                        className="action-body-input"
                        aria-label={t("action.bodyField", { name: field })}
                        placeholder={t("action.bodyPlaceholder")}
                        value={bodyValues[field] ?? ""}
                        onChange={(event) => setBodyValues((current) => ({ ...current, [field]: event.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              <section className="action-response" aria-live="polite" aria-label={t("action.response")}>
                <header>
                  <strong>{t("action.response")}</strong>
                  {result && (
                    <span className={`action-status ${result.succeeded ? "success" : "failed"}`}>
                      {result.statusCode !== null ? `${result.statusCode} ` : ""}
                      {t(result.succeeded ? "action.resultSuccess" : "action.resultFailed")}
                      {result.exitCode !== null && ` · exit ${result.exitCode}`}
                      {result.durationMs !== null && ` · ${result.durationMs} ms`}
                    </span>
                  )}
                </header>
                {!result ? (
                  <p className="action-response-empty">{t("action.responseEmpty")}</p>
                ) : result.output && Object.keys(result.output).length > 0 ? (
                  <dl className="action-output">
                    {Object.entries(result.output).map(([key, value]) => (
                      <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                    ))}
                  </dl>
                ) : (
                  <p className="action-response-empty"><code>{result.resultCode}</code></p>
                )}
              </section>
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

/** Exact name first, then a variable whose name contains the header name. */
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
