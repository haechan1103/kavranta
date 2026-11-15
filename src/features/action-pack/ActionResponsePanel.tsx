import "./ActionResponsePanel.css";

import { useI18n } from "../../i18n";
import type { ActionExecutionResult, ActionRunRecord } from "../../lib/types";

export type ResponseTab = "response" | "history";

interface Props {
  tab: ResponseTab;
  result: ActionExecutionResult | ActionRunRecord | null;
  history: ActionRunRecord[];
  packName: (packId: string) => string;
  onTabChange: (tab: ResponseTab) => void;
  onSelectRecord: (record: ActionRunRecord) => void;
  onClearHistory: () => void;
  onCopy: () => void;
}

/** The latest result's allowlisted metadata and projected output, plus earlier runs. */
export function ActionResponsePanel({ tab, result, history, packName, onTabChange, onSelectRecord, onClearHistory, onCopy }: Props) {
  const { locale, t } = useI18n();
  return (
    <section className="action-response" aria-label={t("action.response")}>
      <header>
        <div className="action-response-tabs" role="tablist" aria-label={t("action.response")}>
          <button role="tab" aria-selected={tab === "response"} onClick={() => onTabChange("response")}>
            {t("action.response")}
          </button>
          <button role="tab" aria-selected={tab === "history"} onClick={() => onTabChange("history")}>
            {t("action.history")} <small>{history.length}</small>
          </button>
        </div>
        {tab === "response" && result && (
          <div className="action-response-meta" aria-live="polite">
            <span className={`action-status ${result.succeeded ? "success" : "failed"}`}>
              {result.statusCode !== null ? `${result.statusCode} ` : ""}
              {t(result.succeeded ? "action.resultSuccess" : "action.resultFailed")}
              {result.exitCode !== null && ` · exit ${result.exitCode}`}
              {result.durationMs !== null && ` · ${result.durationMs} ms`}
            </span>
            <button type="button" className="text-action" onClick={onCopy}>{t("action.copyJson")}</button>
          </div>
        )}
        {tab === "history" && history.length > 0 && (
          <button type="button" className="text-action" onClick={onClearHistory}>{t("action.clearHistory")}</button>
        )}
      </header>
      {tab === "history" ? (
        history.length === 0 ? (
          <p className="action-response-empty">{t("action.historyEmpty")}</p>
        ) : (
          <ol className="action-history">
            {history.map((record) => (
              <li key={record.id}>
                <button type="button" onClick={() => onSelectRecord(record)}>
                  <span className={`action-status ${record.succeeded ? "success" : "failed"}`}>
                    {record.statusCode ?? (record.succeeded ? "OK" : "—")}
                  </span>
                  <span className="action-history-name">{record.requestName ?? packName(record.packId)}</span>
                  <span className="action-history-meta">
                    {record.durationMs !== null ? `${record.durationMs} ms · ` : ""}
                    {new Date(record.at).toLocaleTimeString(locale)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )
      ) : !result ? (
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
  );
}
