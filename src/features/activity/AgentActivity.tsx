import "./AgentActivity.css";
import { useCallback, useEffect, useMemo, useState } from "react";

import { localizeError, useI18n } from "../../i18n";
import * as api from "../../lib/api";
import type { AgentActivityEvent } from "../../lib/types";
import { AgentBrandMark, agentDisplayName } from "../integrations/AgentBrandMark";

interface Props {
  projectId: string;
  onError: (message: string) => void;
}

type OutcomeFilter = "all" | AgentActivityEvent["outcome"];

export function AgentActivity({ projectId, onError }: Props) {
  const { locale, t } = useI18n();
  const [events, setEvents] = useState<AgentActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [actorFilter, setActorFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await api.listAgentActivity(projectId));
    } catch (error) {
      onError(localizeError(error, locale, "activity.loadError"));
    } finally {
      setLoading(false);
    }
  }, [locale, onError, projectId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setOutcomeFilter("all");
    setActorFilter("all");
  }, [projectId]);

  const actors = useMemo(
    () => [...new Set(events.map((event) => event.actor))],
    [events],
  );
  const filteredEvents = useMemo(
    () => events.filter((event) => (
      (outcomeFilter === "all" || event.outcome === outcomeFilter)
      && (actorFilter === "all" || event.actor === actorFilter)
    )),
    [actorFilter, events, outcomeFilter],
  );
  const groups = useMemo(
    () => groupEventsByDay(filteredEvents, locale, t),
    [filteredEvents, locale, t],
  );

  const summaries: Array<{ filter: OutcomeFilter; label: string; count: number }> = [
    { filter: "all", label: t("activity.summary.total"), count: events.length },
    { filter: "allowed", label: t("activity.outcome.allowed"), count: countOutcome(events, "allowed") },
    { filter: "blocked", label: t("activity.outcome.blocked"), count: countOutcome(events, "blocked") },
    { filter: "failed", label: t("activity.outcome.failed"), count: countOutcome(events, "failed") },
  ];

  return (
    <section className="page-stack activity-page">
      <div className="section-heading activity-heading">
        <div>
          <h2>{t("activity.title")}</h2>
          <p>{t("activity.body")}</p>
        </div>
        <div className="activity-heading-actions">
          <label className="activity-tool-filter">
            <span>{t("activity.filters.tool")}</span>
            <select
              value={actorFilter}
              disabled={loading || actors.length === 0}
              onChange={(event) => setActorFilter(event.target.value)}
            >
              <option value="all">{t("activity.filters.allTools")}</option>
              {actors.map((actor) => (
                <option value={actor} key={actor}>{agentDisplayName(actor)}</option>
              ))}
            </select>
          </label>
          <button className="quiet-button" onClick={() => void load()} disabled={loading}>
            {loading ? t("common.checking") : t("common.refresh")}
          </button>
        </div>
      </div>

      {loading && events.length === 0 ? (
        <div className="center-state compact"><span className="spinner" /><p>{t("activity.loading")}</p></div>
      ) : events.length === 0 ? (
        <div className="panel empty-inline"><span>✓</span><p>{t("activity.empty")}</p></div>
      ) : (
        <>
          <div className="activity-summary" aria-label={t("activity.filters.outcome")}>
            {summaries.map((summary) => (
              <button
                className={`activity-summary-card ${summary.filter} ${outcomeFilter === summary.filter ? "selected" : ""}`}
                type="button"
                aria-pressed={outcomeFilter === summary.filter}
                onClick={() => setOutcomeFilter(summary.filter)}
                key={summary.filter}
              >
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
              </button>
            ))}
          </div>

          {groups.length === 0 ? (
            <div className="activity-filter-empty">{t("activity.filters.empty")}</div>
          ) : (
            <div className="activity-timeline">
              {groups.map((group) => (
                <section className="activity-day-group" key={group.key}>
                  <h3>{group.label}</h3>
                  <div className="activity-list">
                    {group.events.map((event, index) => (
                      <article className={`activity-item ${event.outcome}`} key={`${event.timestampMs}:${event.operation}:${index}`}>
                        <AgentBrandMark actor={event.actor} size="regular" />
                        <div className="activity-copy">
                          <div className="activity-primary">
                            <div>
                              <strong>{agentDisplayName(event.actor)}</strong>
                              <span>{t(categoryKey(event.category))}</span>
                            </div>
                            <time dateTime={new Date(event.timestampMs).toISOString()}>
                              {new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(event.timestampMs)}
                            </time>
                          </div>
                          <p className="activity-description">{t(descriptionKey(event.category))}</p>
                          {(event.relativePaths.length > 0 || event.variableNames.length > 0) && (
                            <div className="activity-targets">
                              {event.relativePaths.map((path) => <code key={`p:${path}`}>{path}</code>)}
                              {event.variableNames.map((key) => <code className="variable" key={`k:${key}`}>{key}</code>)}
                            </div>
                          )}
                          <details className="activity-details">
                            <summary>{t("activity.details.show")}</summary>
                            <dl>
                              <div><dt>{t("activity.details.operation")}</dt><dd><code>{event.operation}</code></dd></div>
                              <div><dt>{t("activity.details.policy")}</dt><dd><code>{event.policyDecision}</code></dd></div>
                              <div><dt>{t("activity.details.result")}</dt><dd><code>{event.resultCode}</code></dd></div>
                            </dl>
                          </details>
                        </div>
                        <span className={`activity-result ${event.outcome}`}>{t(outcomeKey(event.outcome))}</span>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function countOutcome(events: AgentActivityEvent[], outcome: AgentActivityEvent["outcome"]) {
  return events.filter((event) => event.outcome === outcome).length;
}

function groupEventsByDay(
  events: AgentActivityEvent[],
  locale: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayDate = new Date(today);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.getTime();
  const groups = new Map<string, { key: string; label: string; events: AgentActivityEvent[] }>();

  for (const event of [...events].sort((left, right) => right.timestampMs - left.timestampMs)) {
    const date = new Date(event.timestampMs);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const label = dayStart === today
      ? t("activity.date.today")
      : dayStart === yesterday
        ? t("activity.date.yesterday")
        : new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
    const group = groups.get(key) ?? { key, label, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function categoryKey(category: AgentActivityEvent["category"]) {
  return ({
    "structure-inspection": "activity.category.structure",
    "value-read": "activity.category.read",
    "provider-compare": "activity.category.providerCompare",
    "action-execution": "activity.category.actionExecution",
    "policy-change": "activity.category.policy",
    mutation: "activity.category.mutation",
  } as const)[category];
}

function descriptionKey(category: AgentActivityEvent["category"]) {
  return ({
    "structure-inspection": "activity.description.structure",
    "value-read": "activity.description.read",
    "provider-compare": "activity.description.providerCompare",
    "action-execution": "activity.description.actionExecution",
    "policy-change": "activity.description.policy",
    mutation: "activity.description.mutation",
  } as const)[category];
}

function outcomeKey(outcome: AgentActivityEvent["outcome"]) {
  return ({
    allowed: "activity.outcome.allowed",
    blocked: "activity.outcome.blocked",
    failed: "activity.outcome.failed",
  } as const)[outcome];
}
