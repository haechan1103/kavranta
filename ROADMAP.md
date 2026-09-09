# Kavranta roadmap: earn repeat use first

Planning baseline: 2026-09-09; release scope updated 2026-09-10. This is an execution
plan, not a release promise.
The next 90 days start when the first external testing cohort is recruited.
Unfinished work below is not advertised as part of the latest installer.

## Who we are building for

First: individual developers and small teams maintaining several local environment
files, often in a monorepo, who repeatedly find, replace, or copy the same named
variable. They already have a working runtime and do not want to migrate it.

The job: **find the right occurrence, change only the intended files, and return to
development with confidence**. Desktop editing must be useful before connecting
an AI agent. Agent reuse and encrypted sharing are second-use reasons, not setup
requirements.

This is not a hosted vault, production secret manager, runtime loader, automatic
production sync, or promise that every AI host is isolated from plaintext files.
See the [security boundary](SECURITY.md).

## What we know—and what we do not

- Signed/notarized macOS installers and a disclosed unsigned Windows beta exist.
  The repository has regression and release checks; these are engineering evidence,
  not evidence that people find the product convenient.
- The README previously placed installation after a long feature history; the
  website was Korean-only and offered a watch-only demo. These are observed entry
  barriers, not proof that fixing them creates demand.
- Repeat use, time to first useful task, and willingness to recommend remain
  unmeasured. Release downloads include maintainer/automation traffic and must not
  be reported as active users.
- We do not have evidence to forecast 500,000 stars. Stars are a distribution
  signal; successful work and voluntary return are the product signals.

## Now: bounded completion work

| Work | Status | Acceptance evidence |
| --- | --- | --- |
| Project-wide variable-name/file/group search | 0.7.6 release scope | Same-name occurrences retain file identity; selecting one focuses the file editor; search never inspects values. |
| First-task navigation and file filtering | 0.7.6 release scope | Missing-value action opens the exact occurrence; name and missing filters compose; hiding a row preserves its draft and clears a revealed value. |
| No-files recovery | 0.7.6 release scope | Explain excluded templates and folder/refresh recovery; do not present zero discovered files as a healthy setup. |
| EN/KO entry page and hands-on linking sample | [GitHub Pages](https://haechan1103.github.io/kavranta/) deployment | Language survives reload in the URL; production starts unselected; changed selection invalidates preview; no real data or external operation. |
| Install-first documentation and feedback loop | In this source change | One clear first desktop task, optional AI step, public roadmap, no unsupported security/sync claim. |

## 90-day sequence

One maintainer owns delivery. Assume four focused engineering days and one
research/support/distribution day per week. These are planning limits, not booked
people or guaranteed dates. Carry at most two engineering items at once. Reserve
one engineering day for regressions; cut scope when support exceeds capacity.

| Window | Deliverable and owner | Exit gate / dependency |
| --- | --- | --- |
| Weeks 1–2: first useful task | Maintainer: ship the source work above through normal gates; publish the static site on an approved host; personally recruit 10 consenting target users. | Observe 10 independent first attempts, across macOS and Windows where available. At least 7 complete the task without a hint in 5 minutes. Report actual platform coverage. |
| Weeks 3–4: remove the largest friction | Maintainer: fix the top two repeated blockers; test inaccessible-project startup and recovery; clarify supported-file discovery. Re-test affected participants. | One complete feedback → fix → re-test cycle. No data loss or protected-value exposure. At least 5 of the original 10 voluntarily use it for a second real task within 7 days; absent follow-ups remain in the denominator. |
| Weeks 5–6: reliability and RC evidence | Maintainer + volunteer testers: clean install, upgrade, uninstall/recovery, older-format compatibility, and agent-boundary checks on supported platforms. | Five or more non-author installations including clean install and update; all RC gates below. Windows signing remains a separate dependency, not a hidden promise. |
| Weeks 7–8: one practical public launch | Maintainer: publish one short task demo and one implementation/tradeoff write-up; post one relevant channel at a time and answer issues. | First-task and return gates passed; known limitations visible; maintainer available for 48 hours. Count qualified testers and completed tasks by source, not impressions alone. |
| Weeks 9–10: second-use workflow | Maintainer: choose either agent-assisted opaque reuse or teammate encrypted handoff based on observed repeated requests. Improve only that flow. | At least 3 independent users report the same obstacle; each can complete the revised workflow; preserve existing security decisions. |
| Weeks 11–13: consolidate | Maintainer: re-run release gates, publish findings and fixes, prepare contributor-sized issues, decide whether stable promotion is justified. | No release blockers; shipped docs match behavior; repeat-use evidence still holds. Expand distribution only if support and reliability remain healthy. |

The 7/10 and 5/10 gates are deliberately small directional experiments, not
statistically reliable population estimates. Repeat with the next cohort before
claiming broad adoption. If recruitment takes longer, the schedule moves.

## Next engineering queue, in order

1. **Selected-project startup isolation.** Current loading awaits all registered
   scans before publishing. Reproduce with a healthy selected project plus an
   unavailable sibling; make sibling failure recoverable without losing useful
   selected-project work. Gate: timeout/error/race regression tests, no stale
   project projection. This fix has not been implemented yet.
2. **Discovery explanations.** Distinguish no supported files, excluded templates,
   unavailable folder, and parse warnings. Show metadata and a concrete recovery
   action; do not silently copy templates or create runtime configuration.
3. **Search stress and keyboard pass.** Synthetic large projects, duplicate names,
   locale casing, narrow window, large text, and draft lifecycle. Optimize only
   after measurement; do not add a persistent value-derived index.
4. **Integration setup friction.** Reproduce reported guard false positives on
   source patches separately from actual protected-file access. Any fix must keep
   direct-value reads denied and pass host-specific guard regressions.
5. **External installation/upgrade evidence.** Keep native-platform results and
   actual user feedback distinct from browser simulations and CI success.

Items can move only when new user evidence or a safety blocker justifies it.
Rank by: severity, independent affected users, first-task/return impact, then
smallest safe effort. Security and data-loss bugs always preempt this queue.

## Measurement without application telemetry

Use an opt-in, maintainer-kept scorecard: participant alias, OS/app version,
recruitment source, task, elapsed time, hints required, outcome, blocker category,
and seven-day second-task yes/no/unknown. Never collect values, project paths,
raw files, broker output, or recordings without specific consent. Keep contact
details private and separate; delete session notes after 30 days and retain only
de-identified aggregates. Do not treat a star or installer download as consent.

Every week publish counts with denominators: contacted → accepted → attempted →
unassisted success → second-task return. Track unresolved blocker age and median
time to resolution. No downloaded-secret examples, background analytics, tracking
pixels, or production credentials in demos.

If fewer than 7/10 succeed, pause broad promotion and fix the most frequent step.
If fewer than 5/10 return, interview non-returners: recurring need, task frequency,
trust, and friction are different problems. If two cohorts still show little
recurring need, narrow the target job; do not respond by adding more providers.

## Distribution principles

- Lead with a useful task: “Change only the files you choose,” followed by a
  30–60 second synthetic example. Avoid a long feature inventory as the opening.
- Offer a no-signup sample, direct installer, clear unsigned-Windows disclosure,
  security limits, and a place for feedback before a broad launch.
- Ask for a workflow critique, not stars or votes. Explain authorship and answer
  criticism. Follow each community's current rules before posting.
- Prefer an installation walkthrough, explicit-link failure case, or redacted
  agent-boundary explanation over generic launch hype.
- Give contributors reproducible synthetic cases and bounded acceptance criteria;
  do not outsource undefined roadmap features as “good first issues.”

## Release gates and deliberate non-goals

Remain on bounded 0.7.x fixes/completion until RC entry is earned. RC requires
format migrations, app/broker/bundle compatibility, native install/update recovery,
core workflow regressions, accurate security claims, onboarding recovery, and an
external feedback/fix cycle with at least five non-author installations. Stable
1.0 additionally requires no known corruption, exposure, or installation blocker,
verified RC upgrades, matching public docs, and a feature freeze.

No feature spree toward an arbitrary star count. Hosted accounts, vault storage,
background cloud sync, inferred links, mandatory runtime wrappers, more platforms,
and new provider adapters are not this cycle's default work. Architectural or
security expansions require their own decision and threat review.

## Help shape the next fix

[Tell us which task was difficult](https://github.com/haechan1103/kavranta/discussions),
including OS, app version, expected result, and the step that stopped you. Use fake
variable names and omit values and private paths. Reproducible bugs belong in
[Issues](https://github.com/haechan1103/kavranta/issues); suspected exposure belongs
in the [private security process](SECURITY.md).
