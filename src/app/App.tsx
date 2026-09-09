import "./App.css";
import { useEffect, useState } from "react";

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
import { Overview } from "../features/overview/Overview";
import { ProjectActions } from "../features/projects/ProjectActions";
import { ProjectSidebar } from "../features/projects/ProjectSidebar";
import { useEnvManager } from "../hooks/useEnvManager";
import { useI18n } from "../i18n";

type View =
  | { kind: "overview" }
  | { kind: "file"; path: string; query?: string }
  | { kind: "integrations" }
  | { kind: "activity" }
  | { kind: "accounts" };

export function App() {
  const { t } = useI18n();
  const manager = useEnvManager();
  const [view, setView] = useState<View>({ kind: "overview" });
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [runningAction, setRunningAction] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [channelPublishing, setChannelPublishing] = useState<string | null>(null);
  const [channelImporting, setChannelImporting] = useState<{ channelId: string; packageId: string } | null>(null);
  const [renamingProject, setRenamingProject] = useState(false);

  useEffect(() => {
    setView({ kind: "overview" });
    setRenamingProject(false);
    setSharing(false);
    setRunningAction(false);
    setChannelPublishing(null);
    setChannelImporting(null);
  }, [manager.selectedProjectId]);

  useEffect(() => {
    if (!manager.error && !manager.notice) return;
    const timeout = window.setTimeout(() => {
      manager.clearError();
      manager.clearNotice();
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [manager.error, manager.notice, manager.clearError, manager.clearNotice]);

  const refresh = async () => {
    if (!manager.selectedProjectId) return;
    await manager.refreshProject(manager.selectedProjectId);
  };

  return (
    <div className="app-shell">
      <ProjectSidebar
        projects={manager.projects}
        selectedProjectId={manager.selectedProjectId}
        projection={manager.projection}
        view={view}
        onSelectProject={manager.selectProject}
        onSelectView={setView}
        onRegister={() => void manager.register()}
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
              if (window.confirm(t("app.removeConfirm"))) {
                void manager.remove(manager.selectedProject!.id);
              }
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
        ) : !manager.selectedProject || !manager.projection ? (
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
                  <small>LOCAL ONLY</small>
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
        ) : (
          <>
            <div className="content-scroll">
              {view.kind === "overview" && (
                <Overview
                  projection={manager.projection}
                  onOpenFile={(path, query) => setView({ kind: "file", path, query })}
                  onOpenIntegrations={() => setView({ kind: "integrations" })}
                  onApplyGitignoreGuard={manager.applyGitignoreGuard}
                />
              )}
              {view.kind === "file" && (
                <FileEditor
                  key={`${manager.selectedProject.id}:${view.path}:${view.query ?? ""}`}
                  projectId={manager.selectedProject.id}
                  projection={manager.projection}
                  filePath={view.path}
                  initialSearch={view.query}
                  onRefresh={refresh}
                  onError={manager.showError}
                  onNotice={manager.showNotice}
                />
              )}
              {view.kind === "activity" && (
                <AgentActivity projectId={manager.selectedProject.id} onError={manager.showError} />
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

      {(manager.error || manager.notice) && (
        <div
          className={`toast ${manager.error ? "toast-error" : "toast-success"}`}
          role="status"
        >
          {manager.error ?? manager.notice}
        </div>
      )}
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
