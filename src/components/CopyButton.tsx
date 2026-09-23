import "./CopyButton.css";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "../i18n";

interface Props {
  className: string;
  label: string;
  title?: string;
  onCopy: () => Promise<void>;
}

type CopyFeedback = "copied" | "failed" | null;

export function CopyButton({ className, label, title = label, onCopy }: Props) {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState<CopyFeedback>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const requestId = useRef(0);
  const timeout = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      requestId.current += 1;
      window.clearTimeout(timeout.current);
    },
    [],
  );

  const copy = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFeedback(null);
    window.clearTimeout(timeout.current);
    const request = ++requestId.current;
    let result: CopyFeedback = "copied";
    try {
      await onCopy();
    } catch {
      result = "failed";
    }
    if (request !== requestId.current) return;
    inFlight.current = false;
    setPending(false);
    setFeedback(result);
    timeout.current = window.setTimeout(() => setFeedback(null), 2000);
  };

  const message =
    feedback === "copied"
      ? t("common.copied")
      : feedback === "failed"
        ? t("common.copyFailed")
        : "";

  return (
    <span className="copy-control">
      <button
        type="button"
        className={`${className}${feedback === "copied" ? " copied" : ""}`}
        aria-label={label}
        title={feedback === "copied" ? message : title}
        disabled={pending}
        onClick={() => void copy()}
      >
      <span className="copy-icon" aria-hidden="true">
        {feedback === "copied" ? <CheckIcon /> : <CopyIcon />}
      </span>
    </button>
      <span
        className="copy-feedback"
        data-outcome={feedback ?? undefined}
        role={feedback ? "status" : undefined}
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </span>
    </span>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="copy-svg">
      <rect x="9" y="9" width="11" height="11" rx="2.4" />
      <path d="M15 5.6A2.6 2.6 0 0 0 12.4 3H6.6A2.6 2.6 0 0 0 4 5.6v5.8A2.6 2.6 0 0 0 6.6 14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="copy-svg">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
