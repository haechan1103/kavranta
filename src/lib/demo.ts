import type {
  AgentIntegrationStatus,
  ProjectProjection,
  ProjectSummary,
  RedactedSourceLine,
  ValueComparison,
  ValueComparisonCell,
} from "./types";

export const demoAgentIntegrations: AgentIntegrationStatus[] = [
  {
    id: "codex",
    name: "Codex",
    detected: true,
    installed: true,
    installedVersion: "1.1.0",
    legacyVersion: false,
    currentVersion: "1.5.0",
    updateAvailable: true,
    needsRepair: false,
    brokerPathMissing: false,
    activationUnverified: false,
    protection: "broker",
    detail: "The redacted broker is connected. Direct-file blocking depends on the Codex permission profile.",
    canInstall: true,
    actionBlocker: null,
  },
  {
    id: "claude-code",
    name: "Claude Code",
    detected: true,
    installed: false,
    installedVersion: null,
    legacyVersion: false,
    currentVersion: "1.5.0",
    updateAvailable: false,
    needsRepair: false,
    brokerPathMissing: false,
    activationUnverified: false,
    protection: "inactive",
    detail: "The tool was detected and can be connected to Kavranta.",
    canInstall: true,
    actionBlocker: null,
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot / VS Code",
    detected: true,
    installed: false,
    installedVersion: null,
    legacyVersion: false,
    currentVersion: "1.5.0",
    updateAvailable: false,
    needsRepair: false,
    brokerPathMissing: false,
    activationUnverified: false,
    protection: "inactive",
    detail: "VS Code was detected, but the Copilot CLI is required before connecting it.",
    canInstall: false,
    actionBlocker: "tool-not-found",
  },
  {
    id: "cursor",
    name: "Cursor",
    detected: true,
    installed: false,
    installedVersion: null,
    legacyVersion: false,
    currentVersion: "2.3.0",
    updateAvailable: false,
    needsRepair: false,
    brokerPathMissing: false,
    activationUnverified: false,
    protection: "inactive",
    detail: "Cursor was detected and can be connected to Kavranta.",
    canInstall: true,
    actionBlocker: null,
  },
  {
    id: "opencode",
    name: "OpenCode",
    detected: true,
    installed: false,
    installedVersion: null,
    legacyVersion: false,
    currentVersion: "2.6.0",
    updateAvailable: false,
    needsRepair: false,
    brokerPathMissing: false,
    activationUnverified: false,
    protection: "inactive",
    detail: "OpenCode was detected and can be connected to Kavranta.",
    canInstall: true,
    actionBlocker: null,
  },
];

export const demoProjects: ProjectSummary[] = [
  {
    id: "demo-project",
    name: "sample-saas",
    displayPath: "/Users/demo/dev/sample-saas",
  },
];

export const demoProjection: ProjectProjection = {
  projectId: "demo-project",
  name: "sample-saas",
  unclassifiedCount: 1,
  accessReviewCount: 1,
  issueCount: 0,
  clientExposureCount: 0,
  classificationReview: [
    {
      key: "GPT_API_KEY",
      files: [".env.local", ".env.development"],
      access: "protected",
      classifiedBy: "heuristic",
      suggestion: { access: "protected", reason: "Contains a secret-looking name pattern." },
      clientExposed: false,
      reviewReasons: [],
    },
    {
      key: "GPT_MODEL",
      files: [".env.local"],
      access: "unclassified",
      classifiedBy: "heuristic",
      suggestion: { access: "unclassified", reason: "Cannot classify safely from its name." },
      clientExposed: false,
      reviewReasons: ["agent-access-request"],
    },
  ],
  gitSafety: {
    state: "protected",
    ignoredFiles: [".env.local", ".env.development", "apps/web/.env.local"],
    missingIgnoreFiles: [],
    trackedFiles: [],
    historyFiles: [],
    remoteHistoryFiles: [],
  },
  files: [
    {
      path: ".env.local",
      displayName: "Local environment",
      warnings: [],
      groups: [
        {
          name: "GPT",
          variables: [
            {
              key: "GPT_API_KEY",
              description: ["Server-only API key"],
              valueState: "present",
              displayValue: null,
              codexAccess: "protected",
              linkedCount: 2,
              linkId: "demo-gpt-link",
              linkedFiles: [".env.local", ".env.development"],
              duplicate: false,
              clientExposure: null,
              hasGuide: false,
            },
            {
              key: "GPT_MODEL",
              description: ["Default response model"],
              valueState: "present",
              displayValue: null,
              codexAccess: "unclassified",
              linkedCount: 0,
              linkId: null,
              linkedFiles: [],
              duplicate: false,
              clientExposure: null,
              hasGuide: false,
            },
            demoVariable("OPENAI_BASE_URL", "Custom API endpoint"),
          ],
        },
        {
          name: "Database",
          variables: [
            demoVariable("DATABASE_URL", "Development database connection", "protected"),
            demoVariable("DATABASE_POOL_SIZE", "Maximum connection pool size"),
            demoVariable("DATABASE_SCHEMA", "Default database schema"),
          ],
        },
        {
          name: "Application",
          variables: [
            {
              key: "PORT",
              description: ["Local development server port"],
              valueState: "present",
              displayValue: null,
              codexAccess: "read-write",
              linkedCount: 0,
              linkId: null,
              linkedFiles: [],
              duplicate: false,
              clientExposure: null,
              hasGuide: false,
            },
            demoVariable("APP_ENV", "Application environment"),
            demoVariable("LOG_LEVEL", "Runtime logging level"),
            demoVariable("ENABLE_CACHE", "Enable the local cache"),
            demoVariable("SESSION_TTL", "Session lifetime in seconds"),
          ],
        },
      ],
    },
    {
      path: ".env.development",
      displayName: "Development",
      warnings: [],
      groups: [
        {
          name: "GPT",
          variables: [
            {
              key: "GPT_API_KEY",
              description: ["API key shared in development"],
              valueState: "present",
              displayValue: null,
              codexAccess: "protected",
              linkedCount: 2,
              linkId: "demo-gpt-link",
              linkedFiles: [".env.local", ".env.development"],
              duplicate: false,
              clientExposure: null,
              hasGuide: false,
            },
          ],
        },
      ],
    },
    {
      path: "apps/web/.env.local",
      displayName: "Web local",
      warnings: [],
      groups: [
        {
          name: "Web",
          variables: [
            {
              key: "NEXT_PUBLIC_APP_URL",
              description: ["Public application URL"],
              valueState: "empty",
              displayValue: null,
              codexAccess: "read-write",
              linkedCount: 0,
              linkId: null,
              linkedFiles: [],
              duplicate: false,
              clientExposure: null,
              hasGuide: false,
            },
          ],
        },
      ],
    },
  ],
};

function demoVariable(
  key: string,
  description: string,
  codexAccess: "protected" | "read-write" = "read-write",
) {
  return {
    key,
    description: [description],
    valueState: "present" as const,
    displayValue: null,
    codexAccess,
    linkedCount: 0,
    linkId: null,
    linkedFiles: [],
    duplicate: false,
    clientExposure: null,
    hasGuide: false,
  };
}

export const demoComparison: ValueComparison = (() => {
  const files = demoProjection.files.map((file) => file.path);
  const keys = [
    ...new Set(demoProjection.files.flatMap((file) => file.groups.flatMap((group) => group.variables.map((variable) => variable.key)))),
  ].sort();
  return {
    files,
    rows: keys.map((key, keyIndex) => {
      const seen: number[] = [];
      return {
        key,
        cells: demoProjection.files.map((file, fileIndex): ValueComparisonCell => {
          const variable = file.groups.flatMap((group) => group.variables).find((entry) => entry.key === key);
          if (!variable) return { state: "missing" };
          if (variable.valueState === "empty") return { state: "empty" };
          // Every third name holds a different value in each file; the rest match.
          const token = keyIndex % 3 === 0 ? fileIndex : -1;
          if (!seen.includes(token)) seen.push(token);
          return { state: "present", group: seen.indexOf(token) };
        }),
      };
    }),
  };
})();

export function demoRedactedSource(path: string): RedactedSourceLine[] {
  const file = demoProjection.files.find((entry) => entry.path === path);
  const lines: RedactedSourceLine[] = [];
  const push = (line: DistributiveOmit<RedactedSourceLine, "line">) => lines.push({ ...line, line: lines.length + 1 } as RedactedSourceLine);
  for (const group of file?.groups ?? []) {
    if (lines.length > 0) push({ kind: "blank" });
    push({ kind: "group", name: group.name });
    for (const variable of group.variables) {
      for (const text of variable.description) push({ kind: "comment", text: ` ${text}` });
      push({ kind: "assignment", key: variable.key, valueState: variable.valueState });
    }
  }
  if (path === ".env.local") push({ kind: "withheld-comment", key: "OLD_API_KEY" });
  return lines;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
