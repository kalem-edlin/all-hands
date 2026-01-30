---
name: browser-automation
description: "Browser-based validation for front-end web implementations — exploratory UX testing, visual regression, accessibility scanning, and end-to-end flow verification"
globs:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.html"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.astro"
  - "**/pages/**"
  - "**/app/**"
  - "**/components/**"
  - "**/layouts/**"
  - "**/views/**"
tools:
  - "agent-browser"
  - "playwright"
  - "@axe-core/playwright"
---

## Purpose

This suite validates browser-based quality across a unified domain: end-to-end flow verification, visual regression, UX quality, and accessibility. These are sub-concerns within a single validation domain — the browser — not separate suites.

The stochastic dimension uses agent-driven browser exploration to probe edge cases, test responsive behavior, verify interaction flows, and discover regressions that scripted tests miss. The deterministic dimension uses Playwright directly for CI-gated visual regression, accessibility scanning, and scripted e2e flows.

Per **Agentic Validation Tooling**, this suite meets the existence threshold: the stochastic dimension (exploratory UX testing, interaction probing, visual state exploration) provides meaningful agent-driven validation beyond what deterministic tests alone can cover.

## Tooling

### agent-browser (stochastic dimension)

- **Installation**: `npm install -g agent-browser && agent-browser install`
- Rust CLI + Node.js daemon built on Playwright. Discrete CLI commands, not a persistent API.
- **Snapshot+Refs model**: Accessibility tree with compact element refs (`@e1`). Refs invalidate on state change — always re-snapshot after navigation or DOM mutation.
- **Session isolation**: Named sessions for parallel exploration. Auth state persists across sessions.
- **Command reference**: `agent-browser --help` and `agent-browser <command> --help`

### Playwright (deterministic dimension)

- **Installation**: `npm install -D @playwright/test @axe-core/playwright && npx playwright install chromium --with-deps`
- Scripted CI tests — visual regression (`toHaveScreenshot()`), accessibility (`@axe-core/playwright`, WCAG 2.1 AA), e2e flows. Not via MCP; no LLM reasoning needed.

## Stochastic Validation

Agent-driven exploratory browser validation. This section teaches WHAT to validate and WHY — the CLI teaches HOW.

### Core Loop

Navigate → snapshot → identify targets → interact → wait for result → verify outcome → check errors.

This is the thinking pattern to internalize, not a command sequence:

- Always re-snapshot after state changes — navigation, form submission, modal appearance, any DOM mutation. Stale refs cause cascading failures.
- Wait for async results before verifying — element appearance, text change, URL update, network settlement
- Verify outcomes before proceeding — never assume an interaction succeeded
- Check console errors after interactions — bugs are often invisible in the visual state

### Use Cases

These seed categories guide exploration. Per **Frontier Models are Capable**, the agent extrapolates deeper investigation from these starting points.

- **Flow verification**: Walk critical user paths end-to-end (registration, checkout, settings). Verify each step completed — form submitted, URL changed, success state appeared. Exercise redirects and back/forward navigation.
- **Responsive testing**: Resize viewport across breakpoints, verify layout at mobile widths. Test media preferences (dark mode, reduced motion). Layout bugs at specific widths are among the most common front-end regressions.
- **Edge case probing**: Submit empty forms, overlong strings, special characters. Verify error handling surfaces appropriate messages. Test keyboard-only navigation — can a user complete flows without a mouse?
- **Accessibility exploration**: Use snapshot to inspect semantic structure (the accessibility tree IS an assistive technology view). Verify Tab order, Enter/Space activation, Escape dismissal, focus management on modals.
- **Evidence capture**: Screenshot before/after interactions for visual comparison. Capture console errors tied to specific flows as bug evidence. Screenshots are opportunistic — capture what's interesting, not on a schedule.
- **Video recording**: Explore first (discover flows, find issues), then record clean replay for engineer review. Recording creates a fresh context but preserves session state — focused evidence, not noisy exploration footage.

### Resilience

Stochastic exploration is inherently unpredictable. These patterns prevent death spirals:

- Max 3 retries on any interaction, then report failure and move on
- Screenshot on failure — capture full-page state before recovery attempts
- Session restart if page becomes unresponsive — fresh session + alternative path
- Auth bail-out — OAuth, MFA, or CAPTCHA blockers: save state, report, move on
- Dialog/frame handling — accept or dismiss dialogs to unblock; switch into iframes for embedded content
- Self-healing pattern — when an element disappears, re-snapshot the entire page rather than retrying the same selector (Stagehand reference)

Use `agent-browser --help` and `agent-browser <command> --help` for all available commands and options. This suite teaches what to validate and why — the CLI teaches how.

## Deterministic Integration

CI-gated browser regression testing using Playwright directly. Scripted assertions — no LLM reasoning needed. Playwright docs and `npx playwright --help` teach specific APIs.

- **Visual regression**: Baseline screenshots committed to repo, fail CI on drift. Mask dynamic content (timestamps, avatars) to avoid false positives. Single OS + browser in CI for font rendering consistency.
- **Accessibility**: `@axe-core/playwright` for WCAG 2.1 AA scanning. Reusable fixture for consistent config. Scope to components for feature tests, full-page for integration.
- **Multi-device**: Chromium-only, desktop/mobile/tablet viewport projects. Responsive regression is a viewport concern, not a browser concern.
- **CI artifacts**: Traces + screenshots on failure for remote debugging. Upload artifacts to survive ephemeral runners.

## ENV Configuration

| Variable | Required | Dimension | Purpose |
|----------|----------|-----------|---------|
| `BASE_URL` | Yes | Both | Dev server URL (e.g., `http://localhost:3000`) |
| `AGENT_BROWSER_SESSION` | No | Stochastic | Named session for isolation |
| `AGENT_BROWSER_PROFILE` | No | Stochastic | Persistent browser profile path for auth state |
| `BROWSERBASE_API_KEY` | No | Both (CI) | Cloud browser provider API key |
| `BROWSERBASE_PROJECT_ID` | No | Both (CI) | Cloud browser provider project ID |
| `CI` | Auto | Deterministic | Set by CI environment; controls retries, reporter |

`BASE_URL` must be configured per-target-project. This suite is framework-agnostic — the agent should discover the target project's dev server configuration at execution time.
