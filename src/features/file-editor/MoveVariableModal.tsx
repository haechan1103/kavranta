import "./MoveVariableModal.css";
import { useState } from "react";

import { Modal } from "../../components/Modal";
import { displayGroupName, useI18n } from "../../i18n";

interface Props {
  variableKey: string;
  currentGroup: string;
  groups: string[];
  onClose: () => void;
  onMove: (targetGroup: string) => Promise<void>;
}

export function MoveVariableModal({ variableKey, currentGroup, groups, onClose, onMove }: Props) {
  const { t } = useI18n();
  const choices = groups.filter((group) => group !== currentGroup);
  const [targetGroup, setTargetGroup] = useState(choices[0] ?? "");
  const [moving, setMoving] = useState(false);

  return (
    <Modal
      title={t("row.moveDialogTitle", { key: variableKey })}
      description={t("row.moveDescription", {
        group: displayGroupName(currentGroup, t),
      })}
      onClose={onClose}
      className="move-variable-modal"
    >
      <form
        className="move-variable-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!targetGroup || moving) return;
          setMoving(true);
          void onMove(targetGroup).then(onClose).finally(() => setMoving(false));
        }}
      >
        <fieldset className="move-group-options">
          <legend>{t("row.moveDestination")}</legend>
          {choices.map((group) => (
            <label className={targetGroup === group ? "selected" : ""} key={group}>
              <input
                type="radio"
                name="target-group"
                value={group}
                checked={targetGroup === group}
                onChange={() => setTargetGroup(group)}
              />
              <span>
                <strong>{displayGroupName(group, t)}</strong>
                <small>{t("row.moveDestinationHelp")}</small>
              </span>
              <span className="choice-check" aria-hidden="true">✓</span>
            </label>
          ))}
        </fieldset>
        <div className="modal-actions">
          <button type="button" className="quiet-button" onClick={onClose}>{t("common.cancel")}</button>
          <button className="primary-button" disabled={!targetGroup || moving}>
            {moving ? t("row.moving") : t("row.moveAction")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
