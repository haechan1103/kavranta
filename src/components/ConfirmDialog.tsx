import { useCallback, useRef, useState, type ReactNode } from "react";

import { useI18n } from "../i18n";
import { Modal } from "./Modal";

export interface ConfirmRequest {
  /** A short, specific question, never "Are you sure?". */
  title: string;
  /** What is affected and what stays. */
  body?: string;
  /** A verb for the action, never Yes/OK. */
  confirmLabel: string;
  tone?: "danger" | "default";
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (confirmed: boolean) => void;
}

/**
 * Application-owned replacement for `window.confirm`. Resolves `true` only when the
 * user presses the confirm button; Cancel, Escape and the backdrop all resolve `false`.
 * Focus starts on Cancel so Enter never confirms a destructive action by accident.
 */
export function useConfirm(): { confirm: (request: ConfirmRequest) => Promise<boolean>; dialog: ReactNode } {
  const { t } = useI18n();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const confirm = useCallback((request: ConfirmRequest) => {
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { ...request, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const finish = (confirmed: boolean) => {
    pendingRef.current?.resolve(confirmed);
    pendingRef.current = null;
    setPending(null);
  };

  const dialog = pending ? (
    <Modal
      title={pending.title}
      description={pending.body}
      className="confirm-dialog"
      onClose={() => finish(false)}
    >
      <div className="modal-actions">
        <button type="button" className="quiet-button" data-initial-focus onClick={() => finish(false)}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className={pending.tone === "danger" ? "danger-button" : "primary-button"}
          onClick={() => finish(true)}
        >
          {pending.confirmLabel}
        </button>
      </div>
    </Modal>
  ) : null;

  return { confirm, dialog };
}
