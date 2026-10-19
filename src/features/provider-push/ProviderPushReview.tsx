import { useI18n } from "../../i18n";
import type { DeploymentProviderId, ProviderEntryKind } from "../../lib/types";

interface Props {
  provider: DeploymentProviderId;
  providerName: string;
  destination: string;
  file: string;
  selections: { key: string; kind: ProviderEntryKind }[];
  isAwsProvider: boolean;
}

/** Names what is about to leave this computer before Push runs (ADR-0045). Never holds values. */
export function ProviderPushReview({ provider, providerName, destination, file, selections, isAwsProvider }: Props) {
  const { t } = useI18n();
  const keepsNoHistory = provider === "github-actions" || provider === "cloudflare-workers" || provider === "expo-eas";
  const kindLabel = (kind: ProviderEntryKind) => {
    if (provider === "cloudflare-workers") return t("push.workerSecret");
    if (isAwsProvider) return t("push.awsSecretType");
    switch (kind) {
      case "variable": return "Variable";
      case "sensitive": return "Sensitive";
      case "plaintext": return "Plain text";
      case "secret": return "Secret";
    }
  };
  return (
    <section className="push-review" aria-label={t("push.reviewTitle")}>
      <dl className="push-review-summary">
        <div>
          <dt>{t("push.reviewDestination")}</dt>
          <dd><strong>{providerName}</strong>{destination && <code>{destination}</code>}</dd>
        </div>
        <div>
          <dt>{t("push.reviewSource")}</dt>
          <dd><code>{file}</code></dd>
        </div>
      </dl>
      <div className="push-review-list">
        <header>
          <strong>{t("push.reviewVariables", { count: selections.length })}</strong>
          <small>{t("push.valuesHidden")}</small>
        </header>
        <ul>
          {selections.map((item) => (
            <li key={item.key}>
              <code>{item.key}</code>
              <span className={`push-review-kind${item.kind === "variable" || item.kind === "plaintext" ? " visible" : ""}`}>
                {kindLabel(item.kind)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="push-review-warning" role="note">
        <strong>{t("push.reviewOverwrite")}</strong>
        {keepsNoHistory && <span>{t("push.reviewNoHistory", { provider: providerName })}</span>}
        {selections.some((item) => item.kind === "variable") && <span>{t("push.variableVisible")}</span>}
      </div>
    </section>
  );
}
