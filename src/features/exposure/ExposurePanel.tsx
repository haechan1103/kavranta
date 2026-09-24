import "./ExposurePanel.css";
import { useCallback, useEffect, useState } from "react";

import { localizeError, useI18n } from "../../i18n";
import * as api from "../../lib/api";
import type {
  ExposureDisposition,
  ExposureProjection,
  ExposureSeverity,
  RedactionProof,
} from "../../lib/types";

interface Props {
  projectId: string;
  onError: (message: string) => void;
}

export function ExposurePanel({ projectId, onError }: Props) {
  const { locale, t } = useI18n();
  const [deep, setDeep] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState<ExposureProjection | null>(null);
  const [proof, setProof] = useState<RedactionProof | null>(null);
  const [proving, setProving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjection(await api.scanExposure(projectId, deep));
    } catch (error) {
      onError(localizeError(error, locale, "error.exposureScan"));
    } finally {
      setLoading(false);
    }
  }, [deep, locale, onError, projectId]);

  const prove = useCallback(async () => {
    setProving(true);
    try {
      setProof(await api.runRedactionSelfCheck());
    } catch (error) {
      onError(localizeError(error, locale, "error.proof"));
    } finally {
      setProving(false);
    }
  }, [locale, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = projection?.counts;

  return (
    <section className="exposure-page">
      <div className="exposure-intro">
        <div>
          <h2>{t("exposure.heading")}</h2>
          <p>{t("exposure.body")}</p>
        </div>
        <button className="quiet-button" onClick={() => void load()} disabled={loading}>
          {loading ? t("exposure.scanning") : t("exposure.refresh")}
        </button>
      </div>

      <label className="exposure-deep">
        <input
          type="checkbox"
          checked={deep}
          onChange={(event) => setDeep(event.target.checked)}
        />
        {t("exposure.deep")}
      </label>

      {counts && (
        <div className="exposure-counts" aria-live="polite">
          <ExposureCount label={t("exposure.certain")} value={counts.certain} tone="danger" />
          <ExposureCount label={t("exposure.likely")} value={counts.likely} tone="warn" />
          <ExposureCount label={t("exposure.possible")} value={counts.possible} tone="muted" />
          <ExposureCount label={t("exposure.allowed")} value={counts.allowed} tone="ok" />
          <ExposureCount label={t("exposure.managed")} value={counts.managed} tone="ok" />
        </div>
      )}

      {projection && (
        <p className="exposure-headline">
          {exposedTotal(projection) === 0
            ? t("exposure.empty")
            : t("exposure.headline", { count: exposedTotal(projection) })}
        </p>
      )}

      {projection && (
        <p className="exposure-metrics">
          {t("exposure.summary", {
            files: projection.filesScanned,
            duration: projection.durationMs,
          })}
        </p>
      )}

      <div className="exposure-proof">
        <button className="quiet-button" onClick={() => void prove()} disabled={proving}>
          {proving ? t("exposure.proofRunning") : t("exposure.proof")}
        </button>
        {proof && (
          <span className="exposure-proof-result" aria-live="polite">
            {proof.passed === proof.total
              ? t("exposure.proofPassed", {
                  passed: proof.passed,
                  total: proof.total,
                  duration: proof.durationMs,
                })
              : t("exposure.proofFailed", { passed: proof.passed, total: proof.total })}
          </span>
        )}
      </div>

      {projection && projection.findings.length > 0 && (
        <ul className="exposure-list">
          {projection.findings.map((finding) => (
            <li className="exposure-item" key={`${finding.kind}:${finding.path}`}>
              <code className="exposure-path">{finding.path}</code>
              <span className="exposure-kind">{finding.kind}</span>
              <span className={`exposure-severity ${finding.disposition}`}>
                {dispositionLabel(finding.disposition, t)}
              </span>
              {finding.disposition === "exposed" && (
                <span className={`exposure-severity ${finding.severity}`}>
                  {severityLabel(finding.severity, t)}
                </span>
              )}
              {finding.reason && (
                <span className="exposure-reason">{reasonLabel(finding.reason, t)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="exposure-footnote">{t("exposure.footnote")}</p>
    </section>
  );
}

function exposedTotal(projection: ExposureProjection): number {
  return projection.counts.certain + projection.counts.likely + projection.counts.possible;
}

function ExposureCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warn" | "muted" | "ok";
}) {
  return (
    <div className={`exposure-count ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function dispositionLabel(
  disposition: ExposureDisposition,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (disposition === "allowed") return t("exposure.allowed");
  if (disposition === "managed") return t("exposure.managed");
  return t("exposure.exposed");
}

function severityLabel(severity: ExposureSeverity, t: ReturnType<typeof useI18n>["t"]) {
  if (severity === "certain") return t("exposure.certain");
  if (severity === "likely") return t("exposure.likely");
  return t("exposure.possible");
}

function reasonLabel(reason: string, t: ReturnType<typeof useI18n>["t"]) {
  if (reason === "ai-allowed-variable") return t("exposure.reason.aiAllowed");
  return t("exposure.reason.userAllowed");
}
