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
        <span aria-hidden="true">{feedback === "copied" ? "✓" : "⧉"}</span>
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
