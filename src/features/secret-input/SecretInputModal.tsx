import "./SecretInputModal.css";
import { useMemo, useState } from "react";

import { Modal } from "../../components/Modal";
import { HelpIcon } from "../../components/icons";
import { displayGroupName, useI18n } from "../../i18n";
import * as api from "../../lib/api";
import type {
  CodexAccess,
  ProjectProjection,
  SecretInputRequest,
  SecretInputResult,
} from "../../lib/types";
import { VariableGuideModal } from "../file-editor/VariableGuideModal";

interface Props {
  request: SecretInputRequest;
  projectId: string | null;
  projection: ProjectProjection | null;
  onClose: () => void;
  onError: (message: string) => void;
}

interface Row {
  name: string;
  file: string;
  group: string;
  classification: CodexAccess;
  value: string;
}

export function SecretInputModal({ request, projectId, projection, onClose, onError }: Props) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>(() =>
    request.entries.map((entry) => ({
      name: entry.name,
      file: entry.file,
      group: entry.group ?? "",
      classification: entry.classification ?? "protected",
      value: "",
    })),
  );
  const [busy, setBusy] = useState(false);
  const [guideKey, setGuideKey] = useState<string | null>(null);
  // Per-name outcomes of the last submit. Shown instead of closing silently, because an
  // entry with an empty value is skipped and used to look identical to a saved one.
  const [report, setReport] = useState<SecretInputResult[] | null>(null);

  const guideKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const file of projection?.files ?? []) {
      for (const group of file.groups) {
        for (const variable of group.variables) {
          if (variable.hasGuide) keys.add(variable.key);
        }
      }
    }
    return keys;
  }, [projection]);

  const fileOptions = useMemo(() => {
    const options = new Set<string>();
    for (const file of projection?.files ?? []) options.add(file.path);
    for (const row of rows) if (row.file) options.add(row.file);
    return [...options].sort();
  }, [projection, rows]);

  const ordered = useMemo(
    () =>
      rows
        .map((row, index) => ({ row, index }))
        .sort((left, right) => {
          const byGroup = left.row.group.localeCompare(right.row.group);
          return byGroup !== 0 ? byGroup : left.row.name.localeCompare(right.row.name);
        }),
    [rows],
  );

  const update = (index: number, patch: Partial<Row>) => {
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  };

  const submit = async () => {
    setBusy(true);
    try {
      const results = await api.submitSecretInput(
        request.requestId,
        request.projectRoot,
        rows.map((row) => ({
          name: row.name,
          file: row.file,
          group: row.group.trim() || undefined,
          classification: row.classification,
          value: row.value,
        })),
      );
      // Close only when everything landed. Otherwise keep the dialog open and say what did
      // not, so the user can fix it instead of believing it saved.
      if (results.every((result) => result.outcome === "added" || result.outcome === "updated")) {
        onClose();
        return;
      }
      setReport(results);
    } catch (error) {
      onError(error instanceof Error ? error.message : t("error.secretInput"));
    } finally {
      setBusy(false);
    }
  };

  const savedCount = report?.filter((r) => r.outcome === "added" || r.outcome === "updated").length ?? 0;
  const problems = report?.filter((r) => r.outcome !== "added" && r.outcome !== "updated") ?? [];

  const cancel = async () => {
    try {
      await api.cancelSecretInput(request.requestId);
    } catch {
      // Cancelling is best-effort; the request times out on its own.
    }
    onClose();
  };

  let lastGroup: string | null = null;

  return (
    <Modal title={t("secretInput.title")} description={t("secretInput.body")} onClose={() => void cancel()} className="secret-input-modal">
      {/* One form around the rows and the actions. The value inputs must be descendants of
          the form for Enter to submit it; wrapping only the buttons left Enter doing
          nothing, so typed values were silently discarded when the dialog was dismissed. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) void submit();
        }}
      >
      <div className="secret-input-rows">
        {ordered.map(({ row, index }) => {
          const header = row.group !== lastGroup ? displayGroupName(row.group || "기타", t) : null;
          lastGroup = row.group;
          return (
            <div className="secret-input-block" key={`${row.name}:${row.file}`}>
              {header !== null && <p className="secret-input-group">{header}</p>}
              <div className="secret-input-row">
                <span className="secret-input-keyline">
                  <strong className="secret-input-key">{row.name}</strong>
                  {projectId && guideKeys.has(row.name) && (
                    <button
                      type="button"
                      className="icon-button guide-button"
                      aria-label={t("guide.open", { key: row.name })}
                      title={t("guide.open", { key: row.name })}
                      onClick={() => setGuideKey(row.name)}
                    >
                      <HelpIcon />
                    </button>
                  )}
                </span>
                <select
                  aria-label={t("secretInput.file")}
                  value={row.file}
                  onChange={(event) => update(index, { file: event.target.value })}
                >
                  {fileOptions.map((file) => (
                    <option key={file} value={file}>
                      {file}
                    </option>
                  ))}
                </select>
                <input
                  type="password"
                  autoComplete="off"
                  aria-label={t("secretInput.value")}
                  placeholder={t("secretInput.value")}
                  value={row.value}
                  onChange={(event) => update(index, { value: event.target.value })}
                />
                <select
                  aria-label={t("secretInput.classification")}
                  value={row.classification}
                  onChange={(event) =>
                    update(index, { classification: event.target.value as CodexAccess })
                  }
                >
                  <option value="protected">{t("secretInput.access.protected")}</option>
                  <option value="read-write">{t("secretInput.access.readWrite")}</option>
                  <option value="unclassified">{t("secretInput.access.unclassified")}</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
      {report && (
        <div className="secret-input-report" role="status">
          <p className="secret-input-report-summary">
            {t("secretInput.reportSummary", { saved: savedCount, missing: problems.length })}
          </p>
          <ul className="secret-input-report-list">
            {problems.map((problem) => (
              <li key={problem.name}>
                <strong>{problem.name}</strong>{" "}
                {problem.outcome === "skipped"
                  ? t("secretInput.reportSkipped")
                  : t("secretInput.reportFailed")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="modal-actions secret-input-actions">
        <button type="button" className="quiet-button" onClick={() => void cancel()} disabled={busy}>
          {t("secretInput.cancel")}
        </button>
        <button type="submit" className="primary-button" disabled={busy}>
          {t("secretInput.submit")}
        </button>
      </div>
      </form>
      {guideKey && projectId && (
        <VariableGuideModal
          projectId={projectId}
          name={guideKey}
          onClose={() => setGuideKey(null)}
          onError={onError}
        />
      )}
    </Modal>
  );
}
