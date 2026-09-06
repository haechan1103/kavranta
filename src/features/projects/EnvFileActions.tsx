import "./EnvFileActions.css";
import { useEffect, useRef, useState } from "react";

import { RenameModal } from "../../components/RenameModal";
import { useI18n } from "../../i18n";

type RenameMode = "label" | "file" | null;

interface Props {
  path: string;
  displayName: string;
  onRenameLabel: (path: string, name: string) => void;
  onRenameFile: (path: string, newName: string) => void;
}

export function EnvFileActions({
  path,
  displayName,
  onRenameLabel,
  onRenameFile,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [renameMode, setRenameMode] = useState<RenameMode>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const physicalName = path.split("/").at(-1) ?? path;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const chooseMode = (mode: Exclude<RenameMode, null>) => {
    setOpen(false);
    setRenameMode(mode);
  };

  return (
    <>
      <div className="env-file-actions" ref={menuRef}>
        <button
          className="env-file-menu-trigger"
          type="button"
          aria-label={t("sidebar.fileActions", { name: displayName })}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((current) => !current)}
        >
          <span aria-hidden="true">⋮</span>
        </button>
        {open && (
          <div className="env-file-action-popover" role="menu">
            <button role="menuitem" onClick={() => chooseMode("label")}>
              <strong>{t("sidebar.renameFileLabel")}</strong>
              <small>{t("sidebar.renameFileLabelMenuHelp")}</small>
            </button>
            <button role="menuitem" onClick={() => chooseMode("file")}>
              <strong>{t("sidebar.renamePhysicalFile")}</strong>
              <small>{t("sidebar.renamePhysicalFileMenuHelp")}</small>
            </button>
          </div>
        )}
      </div>

      {renameMode === "label" && (
        <RenameModal
          title={t("sidebar.fileNamePrompt")}
          description={t("sidebar.fileNameDescription", { file: path })}
          currentName={displayName}
          onClose={() => setRenameMode(null)}
          onRename={(name) => onRenameLabel(path, name)}
        />
      )}
      {renameMode === "file" && (
        <RenameModal
          title={t("sidebar.physicalFileNamePrompt")}
          description={t("sidebar.physicalFileNameDescription", { file: path })}
          currentName={physicalName}
          maxLength={120}
          inputLabel={t("sidebar.physicalFileName")}
          submitLabel={t("sidebar.renamePhysicalFileAction")}
          onClose={() => setRenameMode(null)}
          onRename={(name) => onRenameFile(path, name)}
        />
      )}
    </>
  );
}
