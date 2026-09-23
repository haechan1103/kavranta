import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import * as api from "../../lib/api";
import type { ProjectProjection, SecretInputRequest } from "../../lib/types";
import { SecretInputModal } from "./SecretInputModal";

interface Props {
  projectId: string | null;
  projection: ProjectProjection | null;
  onError: (message: string) => void;
}

export function SecretInputController({ projectId, projection, onError }: Props) {
  const [request, setRequest] = useState<SecretInputRequest | null>(null);

  useEffect(() => {
    if (!api.isTauriRuntime) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listen<SecretInputRequest>("secret-input-request", (event) => {
      if (!cancelled) setRequest(event.payload);
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  if (!request) return null;
  return (
    <SecretInputModal
      key={request.requestId}
      request={request}
      projectId={projectId}
      projection={projection}
      onClose={() => setRequest(null)}
      onError={onError}
    />
  );
}
