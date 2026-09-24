import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import { useI18n } from "../../i18n";
import * as api from "../../lib/api";
import type { ProjectProjection, SecretInputEvent, SecretInputRequest } from "../../lib/types";
import { SecretInputModal } from "./SecretInputModal";

interface Props {
  projectId: string | null;
  projection: ProjectProjection | null;
  refreshProject: (projectId: string) => Promise<ProjectProjection>;
  onError: (message: string) => void;
}

export function SecretInputController({ projectId, projection, refreshProject, onError }: Props) {
  const { t } = useI18n();
  const [request, setRequest] = useState<SecretInputRequest | null>(null);
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(null);
  const [resolvedProjection, setResolvedProjection] = useState<ProjectProjection | null>(null);

  useEffect(() => {
    if (!api.isTauriRuntime) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listen<SecretInputEvent>("secret-input-request", (event) => {
      if (cancelled) return;
      setRequest(event.payload.request);
      const requestedProjectId = event.payload.projectId;
      if (!requestedProjectId) {
        setResolvedProjectId(null);
        setResolvedProjection(null);
        return;
      }
      setResolvedProjectId(requestedProjectId);
      setResolvedProjection(null);
      void refreshProject(requestedProjectId).then(
        (next) => {
          if (!cancelled) setResolvedProjection(next);
        },
        () => {
          if (!cancelled) {
            onError(t("error.secretInputProject"));
            setResolvedProjectId(null);
          }
        },
      );
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refreshProject, onError, t]);

  if (!request) return null;
  return (
    <SecretInputModal
      key={request.requestId}
      request={request}
      projectId={resolvedProjectId ?? projectId}
      projection={resolvedProjection ?? (resolvedProjectId ? null : projection)}
      onClose={() => {
        setRequest(null);
        setResolvedProjectId(null);
        setResolvedProjection(null);
      }}
      onError={onError}
    />
  );
}
