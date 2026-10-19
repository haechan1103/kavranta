import "./ProjectSidebar.css";
import { useState, type ReactNode } from "react";

import type { ProjectProjection, ProjectSummary } from "../../lib/types";
import { supportedLocales, useI18n, type Locale } from "../../i18n";
import {
  supportedFontSizes,
  useDisplayPreferences,
  type FontSize,
} from "../../preferences/DisplayPreferences";
import { AppUpdater } from "../updater/AppUpdater";
import { EnvFileActions } from "./EnvFileActions";
import { useAgentIntegrationStatus } from "../integrations/AgentIntegrationStatusProvider";
import { SidebarNavIcon } from "./SidebarNavIcon";
import { ProjectSwitcherModal } from "./ProjectSwitcherModal";

interface View {
  kind: "overview" | "file" | "integrations" | "activity" | "accounts" | "exposure";
  path?: string;
}

interface Props {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  projection: ProjectProjection | null;
  projectFailures: Record<string, string>;
  view: View;
  onSelectProject: (projectId: string) => void;
  onSelectView: (
    view: { kind: "overview" } | { kind: "file"; path: string } | { kind: "integrations" } | { kind: "activity" } | { kind: "exposure" } | { kind: "accounts" },
  ) => void;
  onRegister: () => void;
  onRenameFileLabel: (projectId: string, path: string, name: string) => void;
  onRenameFileOnDisk: (projectId: string, path: string, newName: string) => void;
  onExportDiagnostics: (destinationLabel: string) => void;
  onOpenPalette: () => void;
  projectActions?: ReactNode;
}

const sidebarViews = [
  { kind: "overview", icon: "overview", label: "sidebar.overview" },
  { kind: "activity", icon: "activity", label: "sidebar.activity" },
  { kind: "exposure", icon: "exposure", label: "sidebar.exposure" },
  { kind: "accounts", icon: "accounts", label: "sidebar.accounts" },
] as const;

export function ProjectSidebar({
  projects,
  selectedProjectId,
  projection,
  projectFailures,
  view,
  onSelectProject,
  onSelectView,
  onRegister,
  onRenameFileLabel,
  onRenameFileOnDisk,
  onExportDiagnostics,
  onOpenPalette,
  projectActions,
}: Props) {
  const { locale, setLocale, t } = useI18n();
  const { fontSize, setFontSize } = useDisplayPreferences();
  const { needsAttention: agentIntegrationNeedsAttention } = useAgentIntegrationStatus();
  const [switchingProject, setSwitchingProject] = useState(false);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedFailure = selectedProjectId ? projectFailures[selectedProjectId] ?? null : null;
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <img src="/brand/kavranta-logo.svg" alt="" />
        </span>
        <span>Kavranta</span>
      </div>

      <section className="current-project-panel" aria-label={t("projectSwitcher.currentProject")}>
        <div className="current-project-identity">
          <span className="project-glyph" aria-hidden="true">
            {selectedProject?.name.slice(0, 1).toUpperCase() ?? "—"}
          </span>
          <span className="current-project-copy">
            <strong>{selectedProject?.name ?? t("projectSwitcher.noneSelected")}</strong>
            {selectedFailure && (
              <small className="project-failed-badge" title={selectedFailure}>
                {t("projectSwitcher.loadFailedBadge")}
              </small>
            )}
          </span>
        </div>
        <button className="project-change-button" type="button" onClick={() => setSwitchingProject(true)}>
          <span className="project-change-label">
            {selectedProject ? t("projectSwitcher.change") : t("projectSwitcher.add")}
          </span>
          <span className="project-change-icon" aria-hidden="true">↕</span>
        </button>
      </section>

      <button type="button" className="sidebar-search" onClick={onOpenPalette}>
        <SidebarNavIcon name="search" />
        <span>{t("palette.open")}</span>
        <kbd>⌘K</kbd>
      </button>

      {projection && (
        <nav className="file-navigation" aria-label={t("sidebar.projectViews")}>
          <p className="file-label">{t("sidebar.envFiles")}</p>
          {projection.files.map((file) => {
            const active = view.kind === "file" && view.path === file.path;
            return (
              <div className="sidebar-file-row" key={file.path}>
                <button
                  className={active ? "nav-item sidebar-file-button active" : "nav-item sidebar-file-button"}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onSelectView({ kind: "file", path: file.path })}
                  title={`${file.displayName}\n${file.path}`}
                >
                  <span className="file-dot" />
                  <span className="sidebar-file-copy">
                    <span className="truncate">{file.displayName}</span>
                    {file.displayName !== file.path && <small className="truncate">{file.path}</small>}
                  </span>
                  {file.warnings.length > 0 && (
                    <b aria-label={t("sidebar.fileWarnings", { count: file.warnings.length })}>!</b>
                  )}
                </button>
                {selectedProjectId && (
                  <EnvFileActions
                    path={file.path}
                    displayName={file.displayName}
                    onRenameLabel={(path, name) => onRenameFileLabel(selectedProjectId, path, name)}
                    onRenameFile={(path, newName) => onRenameFileOnDisk(selectedProjectId, path, newName)}
                  />
                )}
              </div>
            );
          })}

          <p className="file-label">{t("sidebar.views")}</p>
          {sidebarViews.map(({ kind, icon, label }) => (
            <button
              key={kind}
              className={view.kind === kind ? "nav-item active" : "nav-item"}
              aria-current={view.kind === kind ? "page" : undefined}
              onClick={() => onSelectView({ kind })}
            >
              <SidebarNavIcon name={icon} /> {t(label)}
              {kind === "overview" && projection.issueCount > 0 && (
                <b aria-label={t("sidebar.issueCount", { count: projection.issueCount })}>{projection.issueCount}</b>
              )}
            </button>
          ))}

          {selectedProject && projectActions && (
            <>
              <p className="file-label">{t("sidebar.share")}</p>
              {projectActions}
            </>
          )}
        </nav>
      )}

      <div className="sidebar-footer">
        <nav className="agent-navigation footer-agent-navigation" aria-label={t("sidebar.aiTools")}>
          <button
            className={view.kind === "integrations" ? "nav-item active" : "nav-item"}
            onClick={() => onSelectView({ kind: "integrations" })}
          >
            <SidebarNavIcon name="integrations" />
            <span className="agent-nav-label">{t("sidebar.aiConnections")}</span>
            {agentIntegrationNeedsAttention && (
              <span className="attention-dot" aria-label={t("integration.attentionNeeded")} />
            )}
          </button>
        </nav>
        <div className="sidebar-preferences">
          <label className="sidebar-select-control language-control">
            <span>{t("language.label")}</span>
            <select
              value={locale}
              aria-label={t("language.label")}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              {supportedLocales.map((option) => (
                <option value={option.code} key={option.code}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="sidebar-select-control font-size-control">
            <span>{t("fontSize.label")}</span>
            <select
              value={fontSize}
              aria-label={t("fontSize.label")}
              onChange={(event) => setFontSize(event.target.value as FontSize)}
            >
              {supportedFontSizes.map((size) => (
                <option value={size} key={size}>
                  {t(fontSizeLabel(size))}
                </option>
              ))}
            </select>
          </label>
        </div>
        <AppUpdater />
        <button
          className="sidebar-diagnostics-button"
          type="button"
          onClick={() => onExportDiagnostics(t("diagnostics.dialogTitle"))}
        >
          {t("diagnostics.action")}
        </button>
      </div>
      {switchingProject && (
        <ProjectSwitcherModal
          projects={projects}
          selectedProjectId={selectedProjectId}
          projectFailures={projectFailures}
          onClose={() => setSwitchingProject(false)}
          onRegister={onRegister}
          onSelectProject={onSelectProject}
        />
      )}
    </aside>
  );
}

function fontSizeLabel(fontSize: FontSize) {
  const labels = {
    small: "fontSize.small",
    medium: "fontSize.medium",
    large: "fontSize.large",
    "extra-large": "fontSize.extraLarge",
  } as const;
  return labels[fontSize];
}
