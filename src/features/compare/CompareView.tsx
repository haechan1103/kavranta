import "./CompareView.css";
import { useCallback, useEffect, useMemo, useState } from "react";

import { localizeError, useI18n } from "../../i18n";
import * as api from "../../lib/api";
import type { ValueComparison, ValueComparisonCell } from "../../lib/types";

interface Props {
  projectId: string;
  /** Changes whenever the project is rescanned, so the comparison reloads. */
  revision: unknown;
  onOpenVariable: (file: string, key: string) => void;
  onError: (message: string) => void;
}

type RowStatus = "same" | "different" | "partial";

const groupLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const groupTones = ["group-0", "group-1", "group-2", "group-3"] as const;

export function CompareView({ projectId, revision, onOpenVariable, onError }: Props) {
  const { locale, t } = useI18n();
  const [comparison, setComparison] = useState<ValueComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [differencesOnly, setDifferencesOnly] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setComparison(await api.compareProjectValues(projectId));
    } catch (error) {
      onError(localizeError(error, locale, "error.compare"));
    } finally {
      setLoading(false);
    }
  }, [locale, onError, projectId]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  const rows = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (comparison?.rows ?? [])
      .map((row) => ({ ...row, status: rowStatus(row.cells) }))
      .filter((row) => !differencesOnly || row.status !== "same")
      .filter((row) => words.every((word) => row.key.toLowerCase().includes(word)));
  }, [comparison, differencesOnly, query]);

  const counts = useMemo(() => {
    const all = (comparison?.rows ?? []).map((row) => rowStatus(row.cells));
    return {
      same: all.filter((status) => status === "same").length,
      different: all.filter((status) => status === "different").length,
      partial: all.filter((status) => status === "partial").length,
    };
  }, [comparison]);

  const files = comparison?.files ?? [];

  return (
    <section className="compare-page">
      <header className="compare-intro">
        <div>
          <h2>{t("compare.heading")}</h2>
          <p>{t("compare.body")}</p>
        </div>
        <button className="quiet-button" onClick={() => void load()} disabled={loading}>
          {t("common.refresh")}
        </button>
      </header>

      <div className="compare-toolbar">
        <div className="compare-summary" aria-live="polite">
          <span className="compare-pill different">{t("compare.countDifferent", { count: counts.different })}</span>
          <span className="compare-pill partial">{t("compare.countPartial", { count: counts.partial })}</span>
          <span className="compare-pill same">{t("compare.countSame", { count: counts.same })}</span>
        </div>
        <input
          className="compare-search"
          type="search"
          value={query}
          placeholder={t("compare.search")}
          aria-label={t("compare.search")}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="compare-toggle">
          <input
            type="checkbox"
            checked={differencesOnly}
            onChange={(event) => setDifferencesOnly(event.target.checked)}
          />
          {t("compare.differencesOnly")}
        </label>
      </div>

      {files.length < 2 && !loading ? (
        <p className="compare-empty">{t("compare.needTwoFiles")}</p>
      ) : (
        <div className="compare-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">{t("compare.variable")}</th>
                {files.map((file) => (
                  <th key={file} scope="col">
                    <span className="compare-file">{file}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={`compare-row ${row.status}`}>
                  <th scope="row">
                    <span className="compare-key">{row.key}</span>
                    <span className={`compare-status ${row.status}`}>{t(`compare.status.${row.status}`)}</span>
                  </th>
                  {row.cells.map((cell, index) => {
                    const file = files[index] ?? "";
                    return (
                      <td key={file}>
                        <CompareCell
                          cell={cell}
                          distinct={distinctValues(row.cells)}
                          label={t("compare.openIn", { key: row.key, file })}
                          onOpen={() => onOpenVariable(file, row.key)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !loading && (
            <p className="compare-empty">
              {differencesOnly && query.trim() === "" ? t("compare.allSame") : t("compare.noMatches")}
            </p>
          )}
        </div>
      )}
      <p className="compare-footnote">{t("compare.footnote")}</p>
    </section>
  );
}

function CompareCell({
  cell,
  distinct,
  label,
  onOpen,
}: {
  cell: ValueComparisonCell;
  /** How many different values the row holds; letters only matter when there are several. */
  distinct: number;
  label: string;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  if (cell.state === "missing") {
    return <span className="compare-cell missing">{t("compare.cell.missing")}</span>;
  }
  const lettered = cell.state === "present" && distinct > 1;
  const text = cell.state !== "present"
    ? t(`compare.cell.${cell.state}`)
    : lettered
      ? t("compare.cell.value", { letter: groupLetters[cell.group] ?? "?" })
      : t("compare.cell.set");
  const tone = cell.state !== "present" ? cell.state : lettered ? groupTones[Math.min(cell.group, 3)] : "same";
  return (
    <button type="button" className={`compare-cell ${tone}`} aria-label={`${label}: ${text}`} onClick={onOpen}>
      {text}
    </button>
  );
}

function distinctValues(cells: ValueComparisonCell[]): number {
  return new Set(cells.flatMap((cell) => (cell.state === "present" ? [cell.group] : []))).size;
}

function rowStatus(cells: ValueComparisonCell[]): RowStatus {
  if (cells.some((cell) => cell.state !== "present")) return "partial";
  const groups = new Set(cells.map((cell) => (cell.state === "present" ? cell.group : -1)));
  return groups.size > 1 ? "different" : "same";
}
