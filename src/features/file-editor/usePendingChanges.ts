import { useCallback, useMemo, useState } from "react";

import type { OccurrenceProjection } from "../../lib/types";

export type PendingKind = "replace" | "remove";

export interface PendingChange {
  key: string;
  kind: PendingKind;
  /** Files the change writes: the linked members, or just this file. */
  files: string[];
}

/**
 * Staged edits for one open env file (ADR-0042). Drafts are values the user typed and
 * live only as long as the editor; nothing here is persisted.
 */
export function usePendingChanges(file: string, variables: OccurrenceProjection[]) {
  const [drafts, setDrafts] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [removals, setRemovals] = useState<ReadonlySet<string>>(() => new Set());

  const setDraft = useCallback((key: string, value: string) => {
    setDrafts((current) => new Map(current).set(key, value));
    setRemovals((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, []);

  const revert = useCallback((key: string) => {
    setDrafts((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
    setRemovals((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, []);

  const stageRemoval = useCallback((keys: string[]) => {
    setDrafts((current) => {
      const next = new Map(current);
      for (const key of keys) next.delete(key);
      return next;
    });
    setRemovals((current) => new Set([...current, ...keys]));
  }, []);

  const revertAll = useCallback(() => {
    setDrafts(new Map());
    setRemovals(new Set());
  }, []);

  const changes = useMemo<PendingChange[]>(() => {
    const byKey = new Map(variables.map((variable) => [variable.key, variable]));
    const filesFor = (key: string) => {
      const variable = byKey.get(key);
      return variable && variable.linkedFiles.length > 1 ? variable.linkedFiles : [file];
    };
    return [
      ...[...drafts.keys()].map((key) => ({ key, kind: "replace" as const, files: filesFor(key) })),
      ...[...removals].map((key) => ({ key, kind: "remove" as const, files: [file] })),
    ];
  }, [drafts, removals, variables, file]);

  /** Drafts whose variable no longer exists after an external change. */
  const orphaned = useMemo(() => {
    const present = new Set(variables.map((variable) => variable.key));
    return changes.filter((change) => !present.has(change.key)).map((change) => change.key);
  }, [changes, variables]);

  return {
    drafts,
    removals,
    changes,
    orphaned,
    count: changes.length,
    setDraft,
    revert,
    stageRemoval,
    revertAll,
  };
}

export type PendingChanges = ReturnType<typeof usePendingChanges>;
