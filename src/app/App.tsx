import "./App.css";
import { useCallback, useEffect, useState } from "react";

import { useConfirm } from "../components/ConfirmDialog";
import { CloseIcon } from "../components/icons";
import { RenameModal } from "../components/RenameModal";
import { ActionPackModal } from "../features/action-pack/ActionPackModal";
import { FileEditor } from "../features/file-editor/FileEditor";
import { ExportEnvModal } from "../features/export/ExportEnvModal";
import { ImportEnvModal } from "../features/export/ImportEnvModal";
import { ProviderPushModal } from "../features/provider-push/ProviderPushModal";
import { TeamChannelModal } from "../features/team-channel/TeamChannelModal";
import { AgentActivity } from "../features/activity/AgentActivity";
import { AccountVault } from "../features/accounts/AccountVault";
import { AgentIntegrations } from "../features/integrations/AgentIntegrations";
import { ExposurePanel } from "../features/exposure/ExposurePanel";
import { Overview } from "../features/overview/Overview";
import { ProjectActions } from "../features/projects/ProjectActions";
import { ProjectSidebar } from "../features/projects/ProjectSidebar";
import { SecretInputController } from "../features/secret-input/SecretInputController";
import { useEnvManager } from "../hooks/useEnvManager";
import { localizeError, useI18n } from "../i18n";
import * as api from "../lib/api";

type View =
  | { kind: "overview" }
  | { kind: "file"; path: string; query?: string; emptyOnly?: boolean }
  | { kind: "integrations" }
  | { kind: "activity" }
  | { kind: "exposure" }
  | { kind: "accounts" };

export function App() {
  const { locale, t } = useI18n();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const manager = useEnvManager();
  const [view, setView] = useState<View>({ kind: "overview" });
  const [pendingEdits, setPendingEdits] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [runningAction, setRunningAction] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [channelPublishing, setChannelPublishing] = useState<string | null>(null);
  const [channelImporting, setChannelImporting] = useState<{ channelId: string; packageId: string } | null>(null);
  const [renamingProject, setRenamingProject] = useState(false);

  /** Leaving a file with staged edits asks first (ADR-0042). */
  const leaveWithPendingEdits = useCallback(async () => {
    if (pendingEdits === 0) return true;
    const confirmed = await confirm({
      title: t("app.discardTitle", { count: pendingEdits }),
      body: t("app.discardBody"),
      confirmLabel: t("app.discardAction"),
      tone: "danger",
    });
    if (confirmed) setPendingEdits(0);
    return confirmed;
  }, [confirm, pendingEdits, t]);

  const navigate = useCallback((next: View) => {
    void leaveWithPendingEdits().then((leave) => {
      if (leave) setView(next);
    });
  }, [leaveWithPendingEdits]);

  const selectProject = useCallback((projectId: string) => {
    void leaveWithPendingEdits().then((leave) => {
      if (leave) manager.selectProject(projectId);
    });
  }, [leaveWithPendingEdits, manager.selectProject]);

  useEffect(() => {
    setView({ kind: "overview" });
    setRenamingProject(false);
    setSharing(false);
    setRunningAction(false);
    setChannelPublishing(null);
    setChannelImporting(null);
  }, [manager.selectedProjectId]);

  // Notices fade on their own. An error stays until the user dismisses it, so a
  // failure is never missed because it vanished while they looked elsewhere.
  useEffect(() => {
    if (manager.error || !manager.notice) return;
    const timeout = window.setTimeout(manager.clearNotice, 5000);
    return () => window.clearTimeout(timeout);
  }, [manager.error, manager.notice, manager.clearNotice]);

  const refresh = async () => {
    if (!manager.selectedProjectId) return;
    await manager.refreshProject(manager.selectedProjectId);
  };

  const exportDiagnostics = async (dialogTitle: string) => {
    try {
      const result = await api.exportDiagnosticsReport(dialogTitle);
      if (!result) return;
      manager.showNotice(
        t("diagnostics.saved", {
          count: result.projectCount,
          variables: result.variableCount,
          failed: result.failedProjectCount,
        }),
      );
    } catch (error) {
      manager.showError(localizeError(error, locale, "error.diagnostics"));
    }
  };

  return (
    <div className="app-shell">
      <ProjectSidebar
        projects={manager.projects}
        selectedProjectId={manager.selectedProjectId}
        projection={manager.projection}
        projectFailures={manager.projectFailures}
        view={view}
        onSelectProject={selectProject}
        onSelectView={navigate}
        onRegister={() => void manager.register()}
        onExportDiagnostics={(dialogTitle) => void exportDiagnostics(dialogTitle)}
        onRenameFileLabel={(projectId, path, name) => void manager.renameEnvFileLabel(projectId, path, name)}
        onRenameFileOnDisk={(projectId, path, newName) => {
          void manager.renameEnvFileOnDisk(projectId, path, newName).then((summary) => {
            if (!summary) return;
            setView((current) => current.kind === "file" && current.path === summary.oldFile
              ? { kind: "file", path: summary.newFile }
              : current);
          });
        }}
        projectActions={manager.selectedProject && manager.projection ? (
          <ProjectActions
            onRename={() => setRenamingProject(true)}
            onExport={() => setExporting(true)}
            onImport={() => setImporting(true)}
            onShare={() => setSharing(true)}
            onPush={() => setPushing(true)}
            onRunAction={() => setRunningAction(true)}
            onRefresh={() => void refresh()}
            onRemove={() => {
              const projectId = manager.selectedProject!.id;
              void confirm({
                title: t("app.removeConfirmTitle"),
                body: t("app.removeConfirm"),
                confirmLabel: t("common.remove"),
                tone: "danger",
              }).then((confirmed) => {
                if (confirmed) void manager.remove(projectId);
              });
            }}
          />
        ) : undefined}
      />

      <main className="main-panel">
        {view.kind === "integrations" ? (
          <div className="content-scroll">
            <AgentIntegrations
              onError={manager.showError}
              onNotice={manager.showNotice}
            />
          </div>
        ) : manager.loading ? (
          <div className="center-state" aria-live="polite">
            <span className="spinner" />
            <p>{t("app.loadingProjects")}</p>
          </div>
        ) : manager.projects.length === 0 || !manager.selectedProject ? (
          <section className="empty-project-page">
            <header className="empty-project-header">
              <div>
                <h1>{t("app.projectsTitle")}</h1>
                <p>{t("app.projectsSubtitle")}</p>
              </div>
              <button className="primary-button" onClick={() => void manager.register()}>
                {t("app.registerProject")}
              </button>
            </header>

            <div className="onboarding-layout">
              <section className="register-project-card">
                <div className="folder-mark" aria-hidden="true">
                  <span />
                </div>
                <div className="register-project-copy">
                  <p className="eyebrow">{t("app.noProjects")}</p>
                  <h2>{t("app.chooseFolderTitle")}</h2>
                  <p>{t("app.chooseFolderBody")}</p>
                </div>
                <button className="primary-button large" onClick={() => void manager.register()}>
                  {t("app.chooseFolder")}
                </button>
              </section>

              <aside className="registration-details">
                <header>
                  <span>{t("app.afterRegistration")}</span>
                  <small>{t("app.localOnly")}</small>
                </header>
                <dl>
                  <div>
                    <dt>01</dt>
                    <dd>
                      <strong>{t("app.discoveryTitle")}</strong>
                      <span>{t("app.discoveryBody")}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>02</dt>
                    <dd>
                      <strong>{t("app.maskedTitle")}</strong>
                      <span>{t("app.maskedBody")}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>03</dt>
                    <dd>
                      <strong>{t("app.writeTitle")}</strong>
                      <span>{t("app.writeBody")}</span>
                    </dd>
                  </div>
                </dl>
              </aside>
            </div>

            <section className="file-support-strip">
              <div>
                <span className="strip-label">{t("app.autoDiscovery")}</span>
                <code>.env</code>
                <code>.env.local</code>
                <code>.env.development</code>
                <code>.dev.vars</code>
                <code>apps/*/.env</code>
              </div>
              <p><code>.env.example</code> {t("app.examplesExcluded")}</p>
            </section>

            <p className="local-footnote">
              <span className="status-dot" />
              {t("app.localFootnote")}
            </p>
          </section>
        ) : !manager.projection ? (
          <section className="empty-project-page">
            <header className="empty-project-header">
              <div>
                <h1>{t("app.loadFailedTitle")}</h1>
                <p>{t("app.loadFailedBody", { name: manager.selectedProject.name })}</p>
              </div>
              <button className="primary-button" onClick={() => void manager.reload()}>
                {t("app.loadFailedRetry")}
              </button>
            </header>

            <div className="onboarding-layout">
              <section className="register-project-card">
                <div className="folder-mark" aria-hidden="true">
                  <span />
                </div>
                <div className="register-project-copy">
                  <p className="eyebrow">{manager.selectedProject.displayPath}</p>
                  <h2>{t("app.loadFailedHeading")}</h2>
                  <p className="load-failed-reason">
                    {manager.selectedProjectFailure ?? t("app.loadFailedUnknown")}
                  </p>
                </div>
                <button className="primary-button large" onClick={() => void manager.reload()}>
                  {t("app.loadFailedRetry")}
                </button>
              </section>

              <aside className="registration-details">
                <header>
                  <span>{t("app.loadFailedAside")}</span>
                  <small>{t("app.localOnly")}</small>
                </header>
                <dl>
                  <div>
                    <dt>01</dt>
                    <dd>
                      <strong>{t("app.loadFailedMoveTitle")}</strong>
                      <span>{t("app.loadFailedMoveBody")}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>02</dt>
                    <dd>
                      <strong>{t("app.loadFailedReaddTitle")}</strong>
                      <span>{t("app.loadFailedReaddBody")}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>03</dt>
                    <dd>
                      <strong>{t("app.loadFailedOtherTitle")}</strong>
                      <span>{t("app.loadFailedOtherBody")}</span>
                    </dd>
                  </div>
                </dl>
              </aside>
            </div>
          </section>
        ) : (
          <>
            <div className="content-scroll">
              {view.kind === "overview" && (
                <Overview
                  projection={manager.projection}
                  onOpenFile={(path, key, options) =>
                    navigate({ kind: "file", path, query: key, emptyOnly: options?.emptyOnly })
                  }
                  onOpenIntegrations={() => navigate({ kind: "integrations" })}
                  onApplyGitignoreGuard={manager.applyGitignoreGuard}
                />
              )}
              {view.kind === "file" && (
                <FileEditor
                  key={`${manager.selectedProject.id}:${view.path}:${view.query ?? ""}:${view.emptyOnly ? "empty" : ""}`}
                  projectId={manager.selectedProject.id}
                  projection={manager.projection}
                  filePath={view.path}
                  initialSearch={view.query}
                  initialEmptyOnly={view.emptyOnly}
                  onRefresh={refresh}
                  onError={manager.showError}
                  onNotice={manager.showNotice}
                  onPendingChange={setPendingEdits}
                />
              )}
              {view.kind === "activity" && (
                <AgentActivity projectId={manager.selectedProject.id} onError={manager.showError} />
              )}
              {view.kind === "exposure" && (
                <ExposurePanel projectId={manager.selectedProject.id} onError={manager.showError} />
              )}
              {view.kind === "accounts" && (
                <AccountVault
                  projectId={manager.selectedProject.id}
                  projectName={manager.selectedProject.name}
                  onError={manager.showError}
                  onNotice={manager.showNotice}
                />
              )}
            </div>
            {renamingProject && (
              <RenameModal
                title={t("sidebar.projectNamePrompt")}
                currentName={manager.selectedProject.name}
                onClose={() => setRenamingProject(false)}
                onRename={(name) => void manager.renameProject(manager.selectedProject!.id, name)}
              />
            )}
          </>
        )}
      </main>

      {confirmDialog}
      <SecretInputController
        projectId={manager.selectedProject?.id ?? null}
        projection={manager.projection}
        refreshProject={manager.refreshProject}
        onError={manager.showError}
      />
      {manager.error ? (
        <div className="toast toast-error" role="alert">
          <span>{manager.error}</span>
          <button
            type="button"
            className="toast-dismiss"
            aria-label={t("modal.close")}
            onClick={() => {
              manager.clearError();
              manager.clearNotice();
            }}
          >
            <CloseIcon />
          </button>
        </div>
      ) : manager.notice ? (
        <div className="toast toast-success" role="status">
          {manager.notice}
        </div>
      ) : null}
      {exporting && manager.selectedProject && (
        <ExportEnvModal projectId={manager.selectedProject.id} projection={manager.projection!} onClose={() => setExporting(false)} onError={manager.showError} onNotice={manager.showNotice} />
      )}
      {importing && manager.selectedProject && manager.projection && (
        <ImportEnvModal
          projectId={manager.selectedProject.id}
          projection={manager.projection}
          onApplied={() => manager.refreshProject(manager.selectedProject!.id).then(() => undefined)}
          onClose={() => setImporting(false)}
          onError={manager.showError}
          onNotice={manager.showNotice}
        />
      )}
      {pushing && manager.selectedProject && manager.projection && (
        <ProviderPushModal
          projectId={manager.selectedProject.id}
          projection={manager.projection}
          onClose={() => setPushing(false)}
          onError={manager.showError}
          onNotice={manager.showNotice}
        />
      )}
      {runningAction && manager.selectedProject && manager.projection && (
        <ActionPackModal
          projectId={manager.selectedProject.id}
          projection={manager.projection}
          onClose={() => setRunningAction(false)}
          onError={manager.showError}
          onNotice={manager.showNotice}
        />
      )}
      {sharing && manager.selectedProject && (
        <TeamChannelModal
          projectId={manager.selectedProject.id}
          onClose={() => setSharing(false)}
          onError={manager.showError}
          onNotice={manager.showNotice}
          onPublish={(channelId) => {
            setSharing(false);
            setChannelPublishing(channelId);
          }}
          onImport={(channelId, packageId) => {
            setSharing(false);
            setChannelImporting({ channelId, packageId });
          }}
        />
      )}
      {channelPublishing && manager.selectedProject && manager.projection && (
        <ExportEnvModal
          projectId={manager.selectedProject.id}
          projection={manager.projection}
          channelId={channelPublishing}
          onClose={() => setChannelPublishing(null)}
          onError={manager.showError}
          onNotice={manager.showNotice}
        />
      )}
      {channelImporting && manager.selectedProject && manager.projection && (
        <ImportEnvModal
          projectId={manager.selectedProject.id}
          projection={manager.projection}
          channelSource={channelImporting}
          onApplied={() => manager.refreshProject(manager.selectedProject!.id).then(() => undefined)}
          onClose={() => setChannelImporting(null)}
          onError={manager.showError}
          onNotice={manager.showNotice}
        />
      )}
    </div>
  );
}
