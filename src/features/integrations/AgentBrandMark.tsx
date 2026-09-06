import "./AgentBrandMark.css";

const brandAssets: Record<string, { name: string; src: string }> = {
  codex: { name: "Codex", src: "/brand/agents/openai.svg" },
  "claude-code": { name: "Claude Code", src: "/brand/agents/claude.svg" },
  "github-copilot": { name: "GitHub Copilot", src: "/brand/agents/github.svg" },
  cursor: { name: "Cursor", src: "/brand/agents/cursor.svg" },
};

interface Props {
  actor: string;
  size?: "compact" | "regular" | "large";
}

export function AgentBrandMark({ actor, size = "regular" }: Props) {
  const brand = brandAssets[actor];

  return (
    <span className={`agent-brand-mark ${size} ${brand ? actor : "unknown"}`} aria-hidden="true">
      {brand ? (
        <img src={brand.src} alt="" />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M8 8V5.5M16 8V5.5M5 12h14M9 16h.01M15 16h.01" strokeLinecap="round" />
          <rect x="4" y="8" width="16" height="12" rx="3" />
        </svg>
      )}
    </span>
  );
}

export function agentDisplayName(actor: string) {
  return brandAssets[actor]?.name ?? "AI tool";
}
