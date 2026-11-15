import "./ActionBodyEditor.css";

import { useI18n } from "../../i18n";

export type BodyMode = "fields" | "json";

interface Props {
  fields: string[];
  mode: BodyMode;
  values: Record<string, string>;
  json: string;
  error: BodyError | null;
  onModeChange: (mode: BodyMode) => void;
  onValuesChange: (update: (current: Record<string, string>) => Record<string, string>) => void;
  onJsonChange: (json: string) => void;
}

/** Allowlisted body fields as a key-value table or as one raw JSON object. */
export function ActionBodyEditor({ fields, mode, values, json, error, onModeChange, onValuesChange, onJsonChange }: Props) {
  const { t } = useI18n();
  return (
    <div className="action-body" role="tabpanel">
      <div className="action-body-mode" role="group" aria-label={t("action.bodyMode")}>
        {(["fields", "json"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            disabled={option === "fields" && mode === "json" && Boolean(error)}
            onClick={() => onModeChange(option)}
          >
            {option === "fields" ? t("action.bodyFields") : "JSON"}
          </button>
        ))}
        <small>{t("action.bodyAllowed", { fields: fields.join(", ") })}</small>
      </div>
      {mode === "fields" ? (
        <div className="action-table">
          {fields.map((field) => (
            <div className="action-row" key={field}>
              <code className="action-key">{field}</code>
              <input
                className="action-body-input"
                aria-label={t("action.bodyField", { name: field })}
                placeholder={t("action.bodyPlaceholder")}
                value={values[field] ?? ""}
                onChange={(event) => onValuesChange((current) => ({ ...current, [field]: event.target.value }))}
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <textarea
            className={`action-json${error ? " invalid" : ""}`}
            aria-label={t("action.bodyJson")}
            spellCheck={false}
            value={json}
            onChange={(event) => onJsonChange(event.target.value)}
          />
          {error && <p className="action-json-error" role="alert">{t(error)}</p>}
        </>
      )}
    </div>
  );
}

export type BodyError = "action.jsonInvalid" | "action.jsonNotObject" | "action.jsonUnknownField";

/** The raw JSON editor accepts one object whose keys are a subset of the allowlist. */
export function parseBodyJson(text: string, allowed: string[]): { value: string | undefined; error: BodyError | null } {
  if (!text.trim()) return { value: undefined, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { value: undefined, error: "action.jsonInvalid" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { value: undefined, error: "action.jsonNotObject" };
  }
  const keys = Object.keys(parsed);
  if (keys.some((key) => !allowed.includes(key))) return { value: undefined, error: "action.jsonUnknownField" };
  return { value: keys.length > 0 ? JSON.stringify(parsed) : undefined, error: null };
}
