import { useEffect, useMemo, useState } from "react";

import "./VariableGuideModal.css";
import { Markdown } from "../../components/Markdown";
import { Modal } from "../../components/Modal";
import { localizeError, useI18n } from "../../i18n";
import * as api from "../../lib/api";

interface Props {
  projectId: string;
  name: string;
  onClose: () => void;
  onError: (message: string) => void;
}

/**
 * Splits a guide into steps at level-2 headings. Fenced code blocks never
 * split. Content before the first heading stays with the first step. A guide
 * without level-2 headings is a single step.
 */
export function splitGuideSteps(markdown: string): string[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const sections: string[][] = [[]];
  let fenced = false;
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    if (!fenced && /^##\s/.test(line) && sections[sections.length - 1]?.some((member) => member.trim() !== "")) {
      sections.push([]);
    }
    sections[sections.length - 1]?.push(line);
  }
  const steps = sections
    .map((section) => section.join("\n").trim())
    .filter((section) => section !== "");
  return steps.length > 0 ? steps : [markdown];
}

export function VariableGuideModal({ projectId, name, onClose, onError }: Props) {
  const { locale, t } = useI18n();
  const [guide, setGuide] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [step, setStep] = useState(0);

  const load = async (initial: boolean) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      setGuide(await api.readVariableGuide(projectId, name));
    } catch (error) {
      onError(localizeError(error, locale, "error.guide"));
    } finally {
      if (initial) setLoading(false);
      else setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setStep(0);
    setLoading(true);
    void api
      .readVariableGuide(projectId, name)
      .then((value) => {
        if (!cancelled) setGuide(value);
      })
      .catch((error) => {
        if (!cancelled) onError(localizeError(error, locale, "error.guide"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, name, onError, projectId]);

  const steps = useMemo(() => (guide ? splitGuideSteps(guide) : []), [guide]);
  const current = Math.min(step, Math.max(steps.length - 1, 0));

  return (
    <Modal
      title={name}
      description={t("guide.subtitle")}
      onClose={onClose}
      className="guide-modal"
    >
      <div className="guide-body">
        {loading && <p>{t("common.checking")}</p>}
        {!loading && guide && (
          <>
            <div className="guide-toolbar">
              {steps.length > 1 ? (
                <span className="guide-step-count" aria-live="polite">
                  {t("guide.stepOf", { current: current + 1, total: steps.length })}
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="quiet-button guide-refresh"
                disabled={refreshing}
                onClick={() => void load(false)}
              >
                {refreshing ? t("common.checking") : t("guide.refresh")}
              </button>
            </div>
            <Markdown source={steps[current] ?? guide} projectId={projectId} guideKey={name} />
            {steps.length > 1 && (
              <div className="guide-steps">
                <button
                  type="button"
                  className="quiet-button"
                  disabled={current === 0}
                  onClick={() => setStep(current - 1)}
                >
                  {t("guide.prevStep")}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={current === steps.length - 1}
                  onClick={() => setStep(current + 1)}
                >
                  {t("guide.nextStep")}
                </button>
              </div>
            )}
          </>
        )}
        {!loading && !guide && <p className="guide-missing">{t("guide.missing")}</p>}
      </div>
    </Modal>
  );
}
