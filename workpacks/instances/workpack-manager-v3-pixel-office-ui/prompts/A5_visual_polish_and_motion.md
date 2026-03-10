---
depends_on: [A2_agent_animation_runtime, A3_desk_interactions_chat_preview, A4_git_diff_side_panel]
repos: [WorkpackManager]
---
# Feature Implementation Agent Prompt - A5_visual_polish_and_motion

> Apply pixel-art visual polish, motion design, and accessibility refinements across the pixel office UI.

## READ FIRST

1. `workpacks/instances/workpack-manager-v3-pixel-office-ui/00_request.md`
2. `workpacks/instances/workpack-manager-v3-pixel-office-ui/01_plan.md`
3. `outputs/A0_bootstrap.json` — architectural decisions, message protocol, scene model
4. `outputs/A1_pixel_room_shell.json` — room layout, grid dimensions, CSS foundation
5. `outputs/A2_agent_animation_runtime.json` — status-to-animation mapping, sprite structure
6. `outputs/A3_desk_interactions_chat_preview.json` — interaction model, hover preview implementation

## Context

Workpack: `workpack-manager-v3-pixel-office-ui`

This is the final implementation prompt before the verification gate. It depends on A2 and A3 because it refines visuals and motion that those prompts created. All room structure, avatar animation, desk interaction, and diff panel work has already been done; this prompt focuses exclusively on visual quality, palette coherence, animation tuning, and accessibility.

## Delivery Mode

- PR-based

## Objective

Polish the pixel office UI to a cohesive, visually appealing state with consistent palette, deliberate motion design, performant animations, and full accessibility compliance. This prompt does NOT add new features — it refines what A1–A4 built.

## Reference Points

- **Room layout CSS**: created by A1, likely in `src/views/pixel-office/` or similar. Review grid sizing, colors, and font choices.
- **Avatar sprites**: created by A2 with CSS or canvas-based animation. Review timing functions, frame rates, and idle-to-active transitions.
- **Hover/click interactions**: created by A3. Review hover preview positioning, fade timing, tooltip delay.
- **`prefers-reduced-motion`**: CSS media query for accessibility. All animations must degrade gracefully.
- **VS Code theme variables**: `var(--vscode-editor-background)`, `var(--vscode-foreground)`, `var(--vscode-badge-background)`, etc. The pixel room should adapt to the user's theme (light, dark, high contrast).
- **`image-rendering: pixelated`**: enforces crisp pixel edges on scaled pixel-art elements.
- **Performance**: use `will-change` sparingly, prefer `transform` and `opacity` for GPU-accelerated animations, avoid layout thrashing.

## Implementation Requirements

1. **Palette audit**: review all color values used across the room shell, avatars, desks, and UI controls. Establish a consistent palette of 8–12 colors (pixel-art convention). Document the palette as CSS custom properties on the root element.

2. **Theme integration**: ensure the room looks correct in VS Code's default dark, light, and high-contrast themes. Use VS Code CSS variables for backgrounds, borders, and text where it makes semantic sense. For pixel-art decorative elements, the fixed palette is acceptable.

3. **Animation timing review**: audit all CSS transitions and keyframe animations. Ensure:
   - Consistent easing curves (prefer `ease-in-out` for character motion, `ease-out` for UI reveals).
   - Frame duration within 200–600 ms for interactive feedback.
   - Idle animation cycles ≤ 2 seconds.
   - No janky or jarring state changes.

4. **Reduced motion**: wrap all animations in:
   ```css
   @media (prefers-reduced-motion: no-preference) { /* animations here */ }
   ```
   When reduced motion is preferred, replace animations with instant state changes (no transition).

5. **Focus indicators**: ensure all interactive elements (desks, buttons, action menus) have visible focus indicators that meet WCAG 2.1 AA contrast ratios.

6. **Typography**: pixel font (if used) must have a fallback to a system monospace font. Minimum font size: 12px for controls, 10px for decorative labels. Ensure text is not clipped by pixel-grid containers.

7. **Performance profiling**: test with 6+ rooms and 3+ active avatars simultaneously. Verify:
   - No dropped frames during animation.
   - Webview memory usage stays below 50 MB.
   - CSS repaints are contained to animated elements (use `contain: layout paint`).

8. **Empty/loading states**: review the loading state (before data arrives from extension host) and empty state (no workpacks). Ensure both have visual treatment consistent with the pixel-art theme.

## Constraints

- Do NOT add new features, commands, or views — only refine existing visuals.
- Do NOT change the data model, message protocol, or scene model contract from A0.
- Do NOT break any acceptance criteria established by A1–A4.
- Do NOT add external CSS frameworks or large asset files. Keep the webview lightweight.
- All visual changes must preserve keyboard accessibility from A3.

## Scope

### In Scope

- Palette consolidation and documentation as CSS custom properties
- Theme integration (dark, light, high-contrast)
- Animation timing and easing refinements
- `prefers-reduced-motion` compliance
- Focus indicator audit and fixes
- Typography and readability review
- Performance profiling and optimization
- Loading and empty state visual treatment

### Out of Scope

- New features or rooms
- Data model or protocol changes
- Diff panel visual styling (A4 handles its own)
- Sound effects or audio

## Acceptance Criteria

- [ ] AC1: Consistent pixel-art palette documented as CSS custom properties.
- [ ] AC2: Room renders correctly in dark, light, and high-contrast VS Code themes.
- [ ] AC3: All animations respect `prefers-reduced-motion`.
- [ ] AC4: All interactive elements have visible focus indicators.
- [ ] AC5: No visible jank with 6+ rooms and 3+ animated avatars.
- [ ] AC6: `npm run build` and `npm test` pass.

## Verification

```bash
npm run build
npm test
```

Manual verification:
- Switch between dark, light, and high-contrast themes and confirm room appearance.
- Enable "Reduce motion" in OS accessibility settings and confirm animations stop.
- Tab through all interactive elements and confirm focus rings are visible.

## Handoff Output (JSON)

Write `outputs/A5_visual_polish_and_motion.json`.

```json
{
  "schema_version": "1.2",
  "workpack": "workpack-manager-v3-pixel-office-ui",
  "prompt": "A5_visual_polish_and_motion",
  "component": "visual-polish",
  "delivery_mode": "pr",
  "branch": {
    "base": "master",
    "work": "feature/workpack-manager-v3-pixel-office-ui",
    "merge_target": "master"
  },
  "artifacts": {
    "pr_url": "",
    "commit_shas": ["<COMMIT_SHA>"],
    "branch_verified": false
  },
  "changes": {
    "files_modified": [],
    "files_created": [],
    "contracts_changed": [],
    "breaking_change": false
  },
  "verification": {
    "commands": [
      { "cmd": "npm run build", "result": "pass", "notes": "" },
      { "cmd": "npm test", "result": "pass", "notes": "" }
    ],
    "regression_added": false,
    "regression_notes": ""
  },
  "handoff": {
    "summary": "Visual polish applied: palette consolidation, theme integration, animation refinement, reduced-motion compliance, focus indicators.",
    "next_steps": ["V1_integration_meta can now run"],
    "known_issues": []
  },
  "repos": ["WorkpackManager"],
  "execution": {
    "model": "<MODEL_ID>",
    "tokens_in": 0,
    "tokens_out": 0,
    "duration_ms": 0
  },
  "change_details": [],
  "notes": ""
}
```

## Deliverables

- [ ] Palette CSS custom properties documented and applied
- [ ] Theme integration verified in dark, light, and high-contrast
- [ ] Animation timing and easing tuned
- [ ] `prefers-reduced-motion` compliance implemented
- [ ] Focus indicators meet WCAG 2.1 AA
- [ ] Performance profiled and optimized
- [ ] Loading and empty state visual treatment
- [ ] Commit(s) recorded in `artifacts.commit_shas`
- [ ] `outputs/A5_visual_polish_and_motion.json` written
