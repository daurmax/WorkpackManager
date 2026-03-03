---
depends_on: [A0_bootstrap]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A4_webview_error_boundary

> Add a resilient render error boundary so malformed workpack data shows safe fallback UI and logs diagnostics.

---

## READ FIRST

1. `workpacks/instances/workpack-manager-v2/01_workpack-manager-v2_execution-wiring/00_request.md`
2. `workpacks/instances/workpack-manager-v2/01_workpack-manager-v2_execution-wiring/01_plan.md`
3. `workpacks/instances/workpack-manager-v2/01_workpack-manager-v2_execution-wiring/workpack.meta.json`
4. `workpacks/instances/workpack-manager-v2/01_workpack-manager-v2_execution-wiring/workpack.state.json`

## Context

Workpack: `workpack-manager-v2/01_workpack-manager-v2_execution-wiring`

## Delivery Mode

- PR-based

## Objective

Harden `WorkpackDetailPanel` rendering so malformed or missing workpack data cannot break the webview. Rendering failures must produce a safe fallback HTML view and emit actionable diagnostics to an output channel.

## Reference Points

- `src/views/workpack-detail-panel.ts` (`update`, `getHtmlContent`, panel lifecycle/disposal)
- `src/views/__tests__/detail-panel.test.ts` (webview render behavior and malformed data tests)
- `src/views/workpack-tree-provider.ts` (invocation flow to detail panel)
- `workpacks/instances/workpack-manager-v2/01_workpack-manager-v2_execution-wiring/00_request.md` (AC6 + logging constraint)

## Implementation Requirements

- Wrap detail panel HTML generation in an explicit error boundary (`try/catch`) so runtime render exceptions do not propagate to the extension host.
- When render fails, return fallback HTML that:
  - clearly states detail rendering failed,
  - identifies the affected workpack when available,
  - guides users to diagnostics via output channel.
- Create or reuse a dedicated `OutputChannel` for panel diagnostics and append structured error logs for every render failure.
- Do not swallow failures silently: log both message and actionable context (workpack id and error detail).
- Ensure fallback rendering escapes dynamic values and preserves CSP-safe webview markup.
- Ensure disposal path cleans up any output channel, timers, and watchers to avoid leaked resources.
- Add/update tests to verify malformed workpack inputs render fallback HTML and write to output channel.

## Scope

### In Scope
- Error boundary around detail panel HTML rendering
- Fallback UI for malformed workpack/meta/state data
- Output channel logging for detail panel render failures
- Detail panel tests covering fallback and logging behavior

### Out of Scope
- `executePrompt` / `executeAll` command wiring (A1/A2)
- Copilot provider configuration changes (A3)
- Workpack protocol/schema migration

## Acceptance Criteria

- [ ] AC1: Malformed workpack data does not crash `WorkpackDetailPanel` rendering.
- [ ] AC2: Panel shows a readable fallback view instead of blank/broken HTML on render errors.
- [ ] AC3: Render failures are logged to an output channel with workpack context and error detail.
- [ ] AC4: Fallback markup escapes dynamic values and remains CSP-compliant.
- [ ] AC5: Tests are added/updated to cover fallback rendering and logging paths.

## Verification

```bash
npm run build
npm run test -- src/views/__tests__/detail-panel.test.ts
npm run test

# Manual verification
# 1) Open a workpack with malformed meta/state content.
# 2) Run "Workpack: View Details".
# 3) Confirm fallback UI renders in the webview (no broken/blank panel).
# 4) Confirm output channel includes render failure diagnostics.
```

## Deliverables

- [ ] `src/views/workpack-detail-panel.ts` updated with render error boundary and fallback view
- [ ] `src/views/__tests__/detail-panel.test.ts` updated with malformed-data fallback coverage
- [ ] `outputs/A4_webview_error_boundary.json` written
