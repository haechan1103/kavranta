import { useEffect, useState } from "react";

import "./VariableGuideModal.css";
import { Markdown } from "../../components/Markdown";
import { Modal } from "../../components/Modal";
import { localizeError, useI18n } from "../../i18n";
import * as api from "../../lib/api";

interface Props {
  projectId: string;
  name: string;
  onClose: () => void;
  onError: (message: string) => void;
}

export function VariableGuideModal({ projectId, name, onClose, onError }: Props) {
  const { locale, t } = useI18n();
  const [guide, setGuide] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void api
      .readVariableGuide(projectId, name)
      .then((value) => {
        if (!cancelled) setGuide(value);
      })
      .catch((error) => {
        if (!cancelled) onError(localizeError(error, locale, "error.guide"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, name, onError, projectId]);

  return (
    <Modal
      title={name}
      description={t("guide.subtitle")}
      onClose={onClose}
      className="guide-modal"
    >
      <div className="guide-body">
        {loading && <p>{t("common.checking")}</p>}
        {!loading && guide && <Markdown source={guide} />}
        {!loading && !guide && <p className="guide-missing">{t("guide.missing")}</p>}
      </div>
    </Modal>
  );
}
