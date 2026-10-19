import type { ReactNode } from "react";

type SidebarNavIconName =
  | "overview"
  | "compare"
  | "activity"
  | "accounts"
  | "actions"
  | "integrations"
  | "exposure"
  | "push"
  | "share"
  | "run";

interface Props {
  name: SidebarNavIconName;
}

export function SidebarNavIcon({ name }: Props) {
  return (
    <svg
      className="sidebar-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

const iconPaths: Record<SidebarNavIconName, ReactNode> = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
      <rect x="13.5" y="10.5" width="7" height="10" rx="1.5" />
      <rect x="3.5" y="13" width="7" height="7.5" rx="1.5" />
    </>
  ),
  compare: (
    <>
      <rect x="3.5" y="4" width="7" height="16" rx="1.5" />
      <rect x="13.5" y="4" width="7" height="16" rx="1.5" />
      <path d="M6 9h2M6 13h2M16 9h2M16 13h2" />
    </>
  ),
  activity: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </>
  ),
  accounts: (
    <>
      <circle cx="9" cy="9" r="3.3" />
      <path d="M3.8 19c.6-3 2.3-4.7 5.2-4.7s4.6 1.7 5.2 4.7" />
      <path d="M16 8.2a3 3 0 0 1 0 5.6M17 15.6c1.8.5 2.9 1.6 3.3 3.4" />
    </>
  ),
  actions: (
    <>
      <circle cx="5" cy="12" r="1.35" />
      <circle cx="12" cy="12" r="1.35" />
      <circle cx="19" cy="12" r="1.35" />
    </>
  ),
  integrations: (
    <>
      <path d="M8.5 9V5.5M15.5 9V5.5" />
      <rect x="5" y="9" width="14" height="9" rx="3" />
      <path d="M9 13h.01M15 13h.01M9.5 18v2M14.5 18v2" />
    </>
  ),
  exposure: (
    <>
      <path d="M12 3l7 3v5c0 4.4-3 8.2-7 9.5C8 19.2 5 15.4 5 11V6z" />
      <path d="M12 8.5v4M12 15.5h.01" />
    </>
  ),
  push: (
    <>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />
    </>
  ),
  share: (
    <>
      <circle cx="8" cy="9" r="3" />
      <circle cx="17" cy="8" r="2.4" />
      <path d="M3.5 19c.6-3 2.2-4.6 4.5-4.6s3.9 1.6 4.5 4.6M14 13.6c2.3-.4 4.4.8 5.2 3.6" />
    </>
  ),
  run: (
    <>
      <path d="M8 5.5v13l10-6.5z" />
    </>
  ),
};
