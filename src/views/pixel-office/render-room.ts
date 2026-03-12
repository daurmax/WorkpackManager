import type * as vscode from "vscode";
import type { SceneState } from "../../models/pixel-office";
import { buildAvatarRendererScript, buildAvatarRendererStyles } from "./avatar-renderer";

function getNonce(): string {
  const possibleCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  for (let index = 0; index < 32; index += 1) {
    nonce += possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
  }

  return nonce;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeScene(scene: SceneState): string {
  return JSON.stringify(scene)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e");
}

export function buildPixelRoomHtml(webview: vscode.Webview, scene: SceneState): string {
  const nonce = getNonce();
  const serializedScene = serializeScene(scene);
  const avatarStyles = buildAvatarRendererStyles();
  const avatarScript = buildAvatarRendererScript();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <title>${escapeHtml(scene.room.title)}</title>
    <style>
      :root {
        color-scheme: dark light;

        /* ── Pixel-art room palette (decorative, fixed across themes) ── */
        --ink: #241d2f;
        --outline: #3e314f;
        --wall: #705f79;
        --wall-shadow: #5b4e62;
        --floor: #c2ab83;
        --floor-shadow: #a67f58;
        --rug: #2d7d76;
        --rug-shadow: #205f5a;
        --paper: #f7ebc8;
        --paper-shadow: #d8c394;
        --wood: #925f44;
        --wood-shadow: #6b4533;
        --sky: #8cc5ff;

        /* ── Status palette ── */
        --pending: #d1b06a;
        --active: #5f92ff;
        --complete: #63bf73;
        --blocked: #e26068;
        --muted: #9a90a3;
        --attention: #f0a03d;

        /* ── Avatar palette ── */
        --skin: #f1c58a;
        --pants: #2d3d5e;
        --shoe: #2a2026;
        --provider-copilot: #2fbca5;
        --provider-codex: #5f92ff;
        --provider-unassigned: #a091b2;

        /* ── Theme-adaptive shell chrome ── */
        --shell-bg: var(--vscode-editor-background, #0f0c16);
        --shell-fg: var(--vscode-editor-foreground, var(--paper));
        --shell-border: var(--vscode-panel-border, var(--outline));
        --focus-ring: var(--vscode-focusBorder, var(--sky));
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        background: var(--shell-bg);
        color: var(--shell-fg);
        font-family: "Courier New", Consolas, "Liberation Mono", monospace;
      }

      body {
        min-height: 100vh;
      }

      body.vscode-dark {
        background:
          radial-gradient(circle at top, rgba(140, 197, 255, 0.18), transparent 30%),
          linear-gradient(180deg, #15121d 0%, #0f0c16 100%);
      }

      body.vscode-high-contrast {
        background: var(--vscode-editor-background, #000);
      }

      body.vscode-high-contrast-light {
        background: var(--vscode-editor-background, #fff);
      }

      .shell {
        display: grid;
        gap: 20px;
        min-height: 100vh;
        padding: 24px;
      }

      .hud,
      .legend {
        border: 4px solid var(--shell-border);
        background: rgba(36, 29, 47, 0.94);
        box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.28);
      }

      body.vscode-light .hud,
      body.vscode-light .legend {
        background: var(--vscode-sideBar-background, rgba(250, 248, 244, 0.96));
        color: var(--vscode-foreground, #333);
      }

      body.vscode-high-contrast .hud,
      body.vscode-high-contrast .legend,
      body.vscode-high-contrast-light .hud,
      body.vscode-high-contrast-light .legend {
        border-color: var(--vscode-contrastBorder, var(--outline));
        background: var(--vscode-editor-background, #000);
        color: var(--vscode-foreground, #fff);
      }

      .hud {
        display: grid;
        gap: 16px;
        padding: 16px;
      }

      .hud__top {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: baseline;
        justify-content: space-between;
      }

      .hud__title {
        margin: 0;
        color: var(--paper);
        font-size: 24px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .hud__chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .hud__chip,
      .legend__chip,
      .station__badge,
      .desk__status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 3px solid var(--outline);
        padding: 3px 8px;
        line-height: 1.2;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .hud__chip::before,
      .legend__chip::before,
      .desk__status::before {
        content: "";
        width: 10px;
        height: 10px;
        border: 2px solid var(--outline);
        background: currentColor;
        flex: 0 0 auto;
      }

      .hud__stats {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      }

      .hud__stat {
        border: 4px solid var(--outline);
        background: rgba(112, 95, 121, 0.35);
        padding: 10px 12px;
      }

      .hud__stat-value {
        display: block;
        font-size: 28px;
        line-height: 1;
      }

      .hud__stat-label {
        display: block;
        margin-top: 6px;
        color: var(--paper-shadow);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .viewport {
        overflow: auto;
        padding: 12px;
        border: 4px solid rgba(247, 235, 200, 0.12);
        background: rgba(16, 13, 24, 0.52);
      }

      .room {
        position: relative;
        margin: 0 auto;
        border: 8px solid var(--outline);
        box-shadow: 12px 12px 0 rgba(0, 0, 0, 0.3);
        background:
          linear-gradient(180deg, var(--wall) 0 34%, var(--floor) 34% 100%);
        overflow: hidden;
        contain: layout style;
        image-rendering: pixelated;
      }

      body.vscode-high-contrast .room,
      body.vscode-high-contrast-light .room {
        border-color: var(--vscode-contrastBorder, var(--outline));
      }

      .room::before {
        content: "";
        position: absolute;
        inset: 34% 12% 14% 10%;
        border: 6px solid var(--outline);
        background:
          linear-gradient(0deg, transparent 0 78%, rgba(255, 255, 255, 0.08) 78% 82%, transparent 82% 100%),
          linear-gradient(90deg, var(--rug) 0 10%, var(--rug-shadow) 10% 20%, var(--rug) 20% 30%, var(--rug-shadow) 30% 40%, var(--rug) 40% 50%, var(--rug-shadow) 50% 60%, var(--rug) 60% 70%, var(--rug-shadow) 70% 80%, var(--rug) 80% 90%, var(--rug-shadow) 90% 100%);
        box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.18);
      }

      .room::after {
        content: "";
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(36, 29, 47, 0.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(36, 29, 47, 0.12) 1px, transparent 1px);
        background-size: 24px 24px;
        pointer-events: none;
      }

      .room__scene {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .station,
      .desk {
        position: absolute;
        border: 4px solid var(--outline);
        image-rendering: pixelated;
      }

      .station {
        display: grid;
        align-content: space-between;
        padding: 10px;
        background: var(--paper);
        color: var(--ink);
        box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.2);
      }

      .station__sprite {
        position: relative;
        height: 32px;
        border: 4px solid var(--outline);
        background: currentColor;
        opacity: 0.88;
      }

      .station__sprite::before,
      .station__sprite::after {
        content: "";
        position: absolute;
        border: 4px solid var(--outline);
        background: var(--paper);
      }

      .station--request {
        color: var(--active);
      }

      .station--request .station__sprite::before {
        left: 8px;
        top: -8px;
        width: 16px;
        height: 12px;
      }

      .station--request .station__sprite::after {
        right: 8px;
        bottom: -8px;
        width: 20px;
        height: 12px;
      }

      .station--plan {
        color: var(--attention);
      }

      .station--plan .station__sprite::before {
        left: 10px;
        top: 6px;
        width: 18px;
        height: 8px;
        background: var(--paper-shadow);
      }

      .station--plan .station__sprite::after {
        right: 10px;
        top: 6px;
        width: 18px;
        height: 8px;
        background: var(--paper-shadow);
      }

      .station--status {
        color: var(--complete);
      }

      .station--status .station__sprite::before {
        left: 8px;
        top: 6px;
        width: 12px;
        height: 12px;
        background: var(--ink);
      }

      .station--status .station__sprite::after {
        right: 8px;
        top: 6px;
        width: 24px;
        height: 12px;
        background: var(--paper-shadow);
      }

      .station--output-board {
        color: var(--wood);
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0 20%, transparent 20% 40%, rgba(255, 255, 255, 0.08) 40% 60%, transparent 60% 80%, rgba(255, 255, 255, 0.08) 80% 100%),
          #c79c66;
      }

      .station--output-board .station__sprite {
        background:
          linear-gradient(90deg, var(--paper) 0 20%, transparent 20% 100%),
          linear-gradient(180deg, transparent 0 30%, var(--paper-shadow) 30% 60%, transparent 60% 100%),
          var(--wood-shadow);
      }

      .station--output-board .station__sprite::before {
        left: 12px;
        top: 8px;
        width: 16px;
        height: 12px;
        background: var(--paper);
      }

      .station--output-board .station__sprite::after {
        right: 12px;
        top: 8px;
        width: 16px;
        height: 12px;
        background: var(--paper);
      }

      .station__label {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .station__badge {
        width: max-content;
        font-size: 10px;
        background: rgba(255, 255, 255, 0.55);
      }

      .desk {
        appearance: none;
        text-align: left;
        cursor: pointer;
        font: inherit;
        background: var(--wood);
        box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.18);
        color: var(--paper);
        padding: 10px 10px 8px;
        transition: transform 120ms steps(2), box-shadow 120ms steps(2), outline-offset 120ms steps(2);
        contain: layout paint;
      }

      .desk:hover,
      .desk:focus-visible,
      .desk--selected {
        transform: translate(-2px, -2px);
        box-shadow: 10px 10px 0 rgba(0, 0, 0, 0.22);
      }

      .desk:focus-visible {
        outline: 4px solid var(--focus-ring);
        outline-offset: 4px;
      }

      .desk--hovered::before,
      .desk--selected::before {
        background: var(--sky);
      }

      .desk::before {
        content: "";
        position: absolute;
        left: 12px;
        right: 12px;
        top: 12px;
        height: 18px;
        border: 4px solid var(--outline);
        background: var(--wall-shadow);
      }

      .desk::after {
        content: "";
        position: absolute;
        left: 20px;
        bottom: 10px;
        width: 28px;
        height: 14px;
        border: 4px solid var(--outline);
        background: var(--paper);
      }

      .desk__monitor {
        position: absolute;
        right: 14px;
        bottom: 12px;
        width: 28px;
        height: 18px;
        border: 4px solid var(--outline);
        background: var(--sky);
      }

      .desk__label {
        position: absolute;
        left: 10px;
        right: 10px;
        top: 38px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.1;
        text-transform: uppercase;
      }

      .desk__role {
        position: absolute;
        left: 10px;
        right: 10px;
        top: 54px;
        color: rgba(247, 235, 200, 0.88);
        font-size: 10px;
        line-height: 1.2;
      }

      .desk__status {
        position: absolute;
        left: 10px;
        bottom: 8px;
        padding: 2px 6px;
        font-size: 10px;
        color: var(--ink);
        background: var(--paper);
      }

      .desk__status::before,
      .hud__chip::before,
      .legend__chip::before {
        width: 8px;
        height: 8px;
      }

      .desk__agent {
        position: absolute;
        right: 10px;
        top: 38px;
        width: max-content;
        max-width: 40px;
        padding: 2px 4px;
        border: 3px solid var(--outline);
        background: rgba(36, 29, 47, 0.72);
        color: var(--paper);
        font-size: 10px;
        text-transform: uppercase;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .desk-overlay,
      .desk-menu {
        position: absolute;
        border: 4px solid var(--outline);
        background: rgba(22, 18, 31, 0.96);
        box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.24);
        z-index: 5;
      }

      .desk-overlay {
        width: 228px;
        padding: 10px 12px;
        pointer-events: auto;
      }

      .desk-menu {
        width: 212px;
        padding: 10px;
        z-index: 6;
      }

      .desk-overlay__title,
      .desk-menu__title {
        margin: 0 0 6px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
        text-transform: uppercase;
      }

      .desk-overlay__meta,
      .desk-menu__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }

      .desk-overlay__chip,
      .desk-menu__chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        border: 3px solid var(--outline);
        background: rgba(247, 235, 200, 0.14);
        font-size: 10px;
        line-height: 1.2;
        text-transform: uppercase;
      }

      .desk-overlay__text {
        margin: 0;
        color: rgba(247, 235, 200, 0.92);
        font-size: 10px;
        line-height: 1.45;
      }

      .desk-overlay__links,
      .desk-menu__section {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }

      .desk-menu__hint {
        margin: 0;
        color: var(--paper-shadow);
        font-size: 10px;
        line-height: 1.35;
      }

      .desk-menu__button,
      .desk-overlay__link {
        border: 3px solid var(--outline);
        background: var(--paper);
        color: var(--ink);
        padding: 4px 6px;
        font: inherit;
        font-size: 10px;
        line-height: 1.2;
        text-transform: uppercase;
        cursor: pointer;
        pointer-events: auto;
      }

      .desk-menu__button:hover,
      .desk-overlay__link:hover {
        background: #fff4d5;
      }

      .desk-menu__button:focus-visible,
      .desk-overlay__link:focus-visible {
        background: #fff4d5;
        outline: 3px solid var(--focus-ring);
        outline-offset: 2px;
      }

      .desk-menu__button--provider {
        background: #d9eefc;
      }

      .desk-menu__button--action {
        background: #f7ebc8;
      }

      .desk-menu__close {
        margin-left: auto;
        background: rgba(247, 235, 200, 0.18);
        color: var(--paper);
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 12px 16px;
      }

      .status-pending,
      .status-unassigned {
        color: var(--pending);
      }

      .status-in-progress,
      .status-queued {
        color: var(--active);
      }

      .status-complete {
        color: var(--complete);
      }

      .status-blocked,
      .status-failed,
      .status-cancelled {
        color: var(--blocked);
      }

      .status-skipped {
        color: var(--muted);
      }

      .status-human-input-required,
      .status-review,
      .status-unknown {
        color: var(--attention);
      }

      .status-not-started {
        color: var(--muted);
      }

${avatarStyles}

      .loading-state,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 240px;
        border: 4px dashed var(--outline);
        padding: 32px;
        text-align: center;
        color: var(--paper-shadow);
        image-rendering: pixelated;
      }

      .loading-state__icon,
      .empty-state__icon {
        display: block;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        border: 6px solid var(--outline);
        background: var(--wall);
      }

      .loading-state__icon {
        animation: loading-pulse 1.4s ease-in-out infinite;
      }

      .loading-state__label,
      .empty-state__label {
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .empty-state__hint {
        margin-top: 8px;
        font-size: 12px;
        color: var(--muted);
      }

      @keyframes loading-pulse {
        0%, 100% { opacity: 0.4; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.08); }
      }

      @media (max-width: 900px) {
        .shell {
          padding: 16px;
        }

        .hud__title {
          font-size: 20px;
        }

        .viewport {
          padding: 8px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .desk,
        .avatar,
        .avatar__sprite,
        .loading-state__icon {
          animation: none !important;
          transition: none !important;
        }
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script id="pixel-room-state" type="application/json">${serializedScene}</script>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const app = document.getElementById("app");
      const initialStateElement = document.getElementById("pixel-room-state");
      let currentScene = null;
      let selectedDeskId = null;
      let hoveredDeskId = null;
      let hoverDelayToken = null;
      let pendingDeskFocusId = null;
      let pendingMenuFocusId = null;

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function toStatusClass(value) {
        return String(value || "unknown").replaceAll("_", "-");
      }

      function humanize(value) {
        return String(value || "unknown")
          .replaceAll("_", " ")
          .split(" ")
          .filter(function (segment) {
            return segment.length > 0;
          })
          .map(function (segment) {
            return segment.charAt(0).toUpperCase() + segment.slice(1);
          })
          .join(" ");
      }

      function countMatchingStatuses(desks, accepted) {
        return desks.filter(function (desk) {
          return accepted.includes(String(desk.status));
        }).length;
      }

      function postWebviewMessage(message) {
        if (!vscode) {
          return;
        }

        vscode.postMessage(message);
      }

      function findDeskById(scene, deskId) {
        if (!scene || !scene.room || !Array.isArray(scene.room.desks)) {
          return null;
        }

        return scene.room.desks.find(function (desk) {
          return desk.id === deskId;
        }) || null;
      }

      function getDeskFromEventTarget(target) {
        if (!(target instanceof Element)) {
          return null;
        }

        return target.closest("[data-desk-id]") || target.closest("[data-desk-overlay]");
      }

      function getMenuElement(deskId) {
        if (!app || !deskId) {
          return null;
        }

        return app.querySelector('[data-desk-menu="' + deskId + '"]');
      }

      function clearHoverDelay() {
        if (hoverDelayToken) {
          clearTimeout(hoverDelayToken);
          hoverDelayToken = null;
        }
      }

      function ensureUiState(scene) {
        if (selectedDeskId && !findDeskById(scene, selectedDeskId)) {
          selectedDeskId = null;
        }

        if (hoveredDeskId && !findDeskById(scene, hoveredDeskId)) {
          hoveredDeskId = null;
        }
      }

      function setHoveredDesk(desk, hovered) {
        if (!desk) {
          return;
        }

        const nextDeskId = hovered ? desk.id : null;
        if (hoveredDeskId === nextDeskId) {
          return;
        }

        hoveredDeskId = nextDeskId;
        postWebviewMessage({
          type: "DeskHovered",
          deskId: desk.id,
          promptStem: desk.promptStem,
          hovered: hovered,
        });
        renderScene(currentScene);
      }

      function scheduleDeskHover(desk) {
        clearHoverDelay();
        hoverDelayToken = setTimeout(function () {
          hoverDelayToken = null;
          setHoveredDesk(desk, true);
        }, 300);
      }

      function dismissDeskHover(desk) {
        clearHoverDelay();

        if (!desk || hoveredDeskId !== desk.id) {
          return;
        }

        setHoveredDesk(desk, false);
      }

      function openDeskMenu(desk, button) {
        if (!desk) {
          return;
        }

        selectedDeskId = desk.id;
        pendingMenuFocusId = desk.id;
        postWebviewMessage({
          type: "DeskClicked",
          deskId: desk.id,
          promptStem: desk.promptStem,
          button: button || "primary",
        });
        renderScene(currentScene);
      }

      function closeDeskMenu(restoreFocus) {
        if (!selectedDeskId) {
          return;
        }

        pendingDeskFocusId = restoreFocus ? selectedDeskId : null;
        selectedDeskId = null;
        renderScene(currentScene);
      }

      function isWithinDeskContext(target, deskId) {
        if (!(target instanceof Element) || !deskId) {
          return false;
        }

        return Boolean(
          target.closest('[data-desk-id="' + deskId + '"]') ||
          target.closest('[data-desk-menu="' + deskId + '"]') ||
          target.closest('[data-desk-overlay="' + deskId + '"]'),
        );
      }

      function getFloatingPosition(desk, width, height) {
        const roomWidth = Number(currentScene && currentScene.room && currentScene.room.dimensions
          ? currentScene.room.dimensions.width
          : 760);
        const roomHeight = Number(currentScene && currentScene.room && currentScene.room.dimensions
          ? currentScene.room.dimensions.height
          : 560);
        const desiredRight = desk.position.x + desk.dimensions.width + 12;
        const fitsRight = desiredRight + width <= roomWidth - 8;
        const left = fitsRight
          ? desiredRight
          : Math.max(8, desk.position.x - width - 12);
        const top = Math.min(
          Math.max(8, desk.position.y - 4),
          Math.max(8, roomHeight - height - 8),
        );

        return { left: left, top: top };
      }

      function shouldShowProviderActions(desk, providers) {
        return Array.isArray(providers) &&
          providers.length > 0 &&
          (!desk.assignedAgentId || ["blocked", "failed", "cancelled"].includes(String(desk.status)));
      }

${avatarScript}

      function buildStationMarkup(station) {
        const badgeMarkup = station.badgeText
          ? '<span class="station__badge">' + escapeHtml(station.badgeText) + "</span>"
          : "";

        return [
          '<article class="station station--',
          toStatusClass(station.kind),
          station.isPrimary ? " station--primary" : "",
          '" style="left:',
          String(station.position.x),
          "px; top:",
          String(station.position.y),
          "px; width:",
          String(station.dimensions.width),
          "px; height:",
          String(station.dimensions.height),
          'px;" title="',
          escapeHtml(station.label),
          '">',
          '<div class="station__sprite"></div>',
          '<div class="station__label">',
          escapeHtml(station.label),
          "</div>",
          badgeMarkup,
          "</article>",
        ].join("");
      }

      function buildDeskTitle(desk) {
        return Array.isArray(desk.dependsOn) && desk.dependsOn.length > 0
          ? "Depends on: " + desk.dependsOn.join(", ")
          : "Ready from start";
      }

      function buildDeskInnerMarkup(desk) {
        const statusClass = toStatusClass(desk.status);
        const providerLabel = desk.providerDisplayName || desk.assignedAgentId;
        const agentMarkup = providerLabel
          ? '<span class="desk__agent">' + escapeHtml(providerLabel) + "</span>"
          : "";

        return [
          '<div class="desk__monitor"></div>',
          '<div class="desk__label">',
          escapeHtml(desk.label),
          "</div>",
          '<div class="desk__role">',
          escapeHtml(desk.promptRole),
          "</div>",
          '<div class="desk__status status-',
          statusClass,
          '">',
          escapeHtml(humanize(desk.status)),
          "</div>",
          agentMarkup,
        ].join("");
      }

      function buildDeskMarkup(desk) {
        const statusClass = toStatusClass(desk.status);
        const stateClassNames = [
          "desk",
          "status-" + statusClass,
          hoveredDeskId === desk.id ? "desk--hovered" : "",
          selectedDeskId === desk.id ? "desk--selected" : "",
        ]
          .filter(function (value) {
            return value.length > 0;
          })
          .join(" ");

        return [
          '<button type="button" class="',
          stateClassNames,
          '" data-desk-id="',
          escapeHtml(desk.id),
          '" data-prompt-stem="',
          escapeHtml(desk.promptStem),
          '" aria-haspopup="dialog" aria-expanded="',
          selectedDeskId === desk.id ? "true" : "false",
          '" style="left:',
          String(desk.position.x),
          "px; top:",
          String(desk.position.y),
          "px; width:",
          String(desk.dimensions.width),
          "px; height:",
          String(desk.dimensions.height),
          'px;" title="',
          escapeHtml(buildDeskTitle(desk)),
          '">',
          buildDeskInnerMarkup(desk),
          "</button>",
        ].join("");
      }

      function buildPreviewMarkup(desk) {
        if (!desk || hoveredDeskId !== desk.id || !desk.preview) {
          return "";
        }

        const position = getFloatingPosition(desk, 228, 136);
        const links = Array.isArray(desk.preview.links)
          ? desk.preview.links.map(function (link) {
            return [
              '<button type="button" class="desk-overlay__link" data-prompt-action="',
              escapeHtml(link.action),
              '" data-desk-id="',
              escapeHtml(desk.id),
              '" data-prompt-stem="',
              escapeHtml(desk.promptStem),
              '">',
              escapeHtml(link.label),
              "</button>",
            ].join("");
          }).join("")
          : "";

        return [
          '<aside class="desk-overlay" data-desk-overlay="',
          escapeHtml(desk.id),
          '" style="left:',
          String(position.left),
          "px; top:",
          String(position.top),
          'px;" aria-live="polite">',
          '<div class="desk-overlay__title">',
          escapeHtml(desk.label),
          "</div>",
          '<div class="desk-overlay__meta">',
          '<span class="desk-overlay__chip">',
          escapeHtml(desk.preview.providerLabel),
          "</span>",
          '<span class="desk-overlay__chip status-',
          toStatusClass(desk.status),
          '">',
          escapeHtml(desk.preview.statusLabel),
          "</span>",
          "</div>",
          '<p class="desk-overlay__text">',
          escapeHtml(desk.preview.excerpt),
          "</p>",
          '<div class="desk-overlay__links">',
          links,
          "</div>",
          "</aside>",
        ].join("");
      }

      function buildMenuProviderButtons(desk, providers) {
        if (!shouldShowProviderActions(desk, providers)) {
          return "";
        }

        const assignVerb = desk.assignedAgentId ? "Reassign" : "Assign";
        return providers.map(function (provider) {
          return [
            '<button type="button" class="desk-menu__button desk-menu__button--provider" data-provider-id="',
            escapeHtml(provider.id),
            '" data-desk-id="',
            escapeHtml(desk.id),
            '" data-prompt-stem="',
            escapeHtml(desk.promptStem),
            '">',
            escapeHtml(assignVerb + " " + provider.label),
            "</button>",
          ].join("");
        }).join("");
      }

      function buildMenuActionButtons(desk) {
        if (!Array.isArray(desk.actions) || desk.actions.length === 0) {
          return "";
        }

        return desk.actions.map(function (action) {
          return [
            '<button type="button" class="desk-menu__button desk-menu__button--action" data-prompt-action="',
            escapeHtml(action.action),
            '" data-desk-id="',
            escapeHtml(desk.id),
            '" data-prompt-stem="',
            escapeHtml(desk.promptStem),
            '">',
            escapeHtml(action.label),
            "</button>",
          ].join("");
        }).join("");
      }

      function buildMenuMarkup(scene) {
        const desk = findDeskById(scene, selectedDeskId);
        if (!desk) {
          return "";
        }

        const providers = Array.isArray(scene.providers) ? scene.providers : [];
        const position = getFloatingPosition(desk, 212, 176);
        const providerButtons = buildMenuProviderButtons(desk, providers);
        const actionButtons = buildMenuActionButtons(desk);
        const emptyState = providerButtons.length === 0 && actionButtons.length === 0
          ? '<p class="desk-menu__hint">No actions are available for this desk right now.</p>'
          : "";

        return [
          '<aside class="desk-menu" data-desk-menu="',
          escapeHtml(desk.id),
          '" style="left:',
          String(position.left),
          "px; top:",
          String(position.top),
          'px;" role="dialog" aria-label="Desk actions for ',
          escapeHtml(desk.label),
          '">',
          '<div class="desk-menu__title">',
          escapeHtml(desk.label),
          "</div>",
          '<div class="desk-menu__meta">',
          '<span class="desk-menu__chip">',
          escapeHtml(desk.preview.providerLabel),
          "</span>",
          '<span class="desk-menu__chip status-',
          toStatusClass(desk.status),
          '">',
          escapeHtml(desk.preview.statusLabel),
          "</span>",
          "</div>",
          providerButtons.length > 0
            ? '<div class="desk-menu__section">' + providerButtons + "</div>"
            : "",
          actionButtons.length > 0
            ? '<div class="desk-menu__section">' + actionButtons + "</div>"
            : "",
          emptyState,
          '<div class="desk-menu__section">',
          '<button type="button" class="desk-menu__button desk-menu__close" data-dismiss-menu="true">Close</button>',
          "</div>",
          "</aside>",
        ].join("");
      }

      function buildHudMarkup(scene) {
        const desks = Array.isArray(scene.room.desks) ? scene.room.desks : [];
        const completed = countMatchingStatuses(desks, ["complete", "skipped"]);
        const active = countMatchingStatuses(desks, ["queued", "in_progress", "human_input_required"]);
        const blocked = countMatchingStatuses(desks, ["blocked", "failed", "cancelled"]);
        const overallStatusClass = toStatusClass(scene.room.overallStatus);

        return [
          '<div class="hud__top">',
          '<h1 class="hud__title">',
          escapeHtml(scene.room.title),
          "</h1>",
          '<div class="hud__chip-row">',
          '<span class="hud__chip status-',
          overallStatusClass,
          '">',
          escapeHtml(humanize(scene.room.overallStatus)),
          "</span>",
          '<span class="hud__chip">',
          "Tile " + escapeHtml(String(scene.room.tileSize)) + "px",
          "</span>",
          "</div>",
          "</div>",
          '<div class="hud__chip-row">',
          '<span class="hud__chip">',
          escapeHtml(scene.workpackId),
          "</span>",
          '<span class="hud__chip">',
          escapeHtml(scene.room.folderPath),
          "</span>",
          "</div>",
          '<div class="hud__stats">',
          '<div class="hud__stat"><span class="hud__stat-value">',
          escapeHtml(String(desks.length)),
          '</span><span class="hud__stat-label">Prompt Desks</span></div>',
          '<div class="hud__stat"><span class="hud__stat-value">',
          escapeHtml(String(completed)),
          '</span><span class="hud__stat-label">Done Or Skipped</span></div>',
          '<div class="hud__stat"><span class="hud__stat-value">',
          escapeHtml(String(active)),
          '</span><span class="hud__stat-label">Live Runtime</span></div>',
          '<div class="hud__stat"><span class="hud__stat-value">',
          escapeHtml(String(blocked)),
          '</span><span class="hud__stat-label">Blocked / Failed</span></div>',
          "</div>",
        ].join("");
      }

      function buildRoomMarkup(scene) {
        const stations = Array.isArray(scene.room.stations) ? scene.room.stations : [];
        const desks = Array.isArray(scene.room.desks) ? scene.room.desks : [];
        const roomClassName = isReducedMotionEnabled() ? "room room--reduced-motion" : "room";
        const hoveredDesk = findDeskById(scene, hoveredDeskId);

        return [
          '<div class="',
          roomClassName,
          '" data-room style="width:',
          String(scene.room.dimensions.width),
          "px; height:",
          String(scene.room.dimensions.height),
          'px;">',
          '<div class="room__scene">',
          stations.map(buildStationMarkup).join(""),
          desks.map(buildDeskMarkup).join(""),
          '<div class="avatar-layer" data-avatar-layer>',
          buildAvatarLayerMarkup(scene),
          "</div>",
          buildPreviewMarkup(hoveredDesk),
          buildMenuMarkup(scene),
          "</div>",
          "</div>",
        ].join("");
      }

      function buildLegendMarkup() {
        return [
          '<span class="legend__chip status-pending">Pending</span>',
          '<span class="legend__chip status-in-progress">In Progress</span>',
          '<span class="legend__chip status-complete">Complete</span>',
          '<span class="legend__chip status-blocked">Blocked</span>',
          '<span class="legend__chip status-human-input-required">Needs Input</span>',
          '<span class="legend__chip">Tab + Enter Opens Desk Actions</span>',
        ].join("");
      }

      function renderHud(scene) {
        const hud = app ? app.querySelector("[data-hud]") : null;
        if (!hud) {
          return;
        }

        hud.innerHTML = buildHudMarkup(scene);
      }

      function renderRoom(scene) {
        const viewport = app ? app.querySelector("[data-viewport]") : null;
        if (!viewport) {
          return;
        }

        viewport.innerHTML = buildRoomMarkup(scene);
        syncAvatarLifecycleTimers();
      }

      function focusPendingInteractiveElement() {
        if (!app) {
          return;
        }

        if (pendingMenuFocusId) {
          const menu = getMenuElement(pendingMenuFocusId);
          const firstButton = menu ? menu.querySelector("button") : null;
          pendingMenuFocusId = null;
          if (firstButton instanceof HTMLElement) {
            firstButton.focus();
            return;
          }
        }

        if (pendingDeskFocusId) {
          const deskElement = app.querySelector('[data-desk-id="' + pendingDeskFocusId + '"]');
          pendingDeskFocusId = null;
          if (deskElement instanceof HTMLElement) {
            deskElement.focus();
          }
        }
      }

      function renderScene(scene) {
        if (!app) {
          return;
        }

        if (!scene || !scene.room) {
          app.innerHTML = [
            '<main class="shell">',
            '<section class="hud" data-hud>',
            '<h1 class="hud__title">Pixel Office</h1>',
            '</section>',
            '<section class="viewport" data-viewport>',
            '<div class="loading-state">',
            '<span class="loading-state__icon" aria-hidden="true"></span>',
            '<span class="loading-state__label">Loading workspace\u2026</span>',
            '</div>',
            '</section>',
            '</main>',
          ].join("");
          return;
        }

        ensureUiState(scene);

        var hasDesks = Array.isArray(scene.room.desks) && scene.room.desks.length > 0;
        var viewportContent = hasDesks
          ? ""
          : [
            '<div class="empty-state">',
            '<span class="empty-state__icon" aria-hidden="true"></span>',
            '<span class="empty-state__label">No prompt desks</span>',
            '<span class="empty-state__hint">This workpack has no prompts configured yet.</span>',
            '</div>',
          ].join("");

        app.innerHTML = [
          '<main class="shell">',
          '<section class="hud" data-hud></section>',
          '<section class="viewport" data-viewport>',
          viewportContent,
          '</section>',
          '<section class="legend">',
          buildLegendMarkup(),
          "</section>",
          "</main>",
        ].join("");

        renderHud(scene);
        if (hasDesks) {
          renderRoom(scene);
        }
        focusPendingInteractiveElement();
      }

      function applyDeskStatusChange(message) {
        if (!currentScene || !currentScene.room || !Array.isArray(currentScene.room.desks)) {
          return;
        }

        const desk = currentScene.room.desks.find(function (candidate) {
          return candidate.id === message.deskId;
        });

        if (!desk) {
          return;
        }

        desk.status = message.status;

        if (Object.prototype.hasOwnProperty.call(message, "assignedAgentId")) {
          desk.assignedAgentId = message.assignedAgentId;
        }

        if (Object.prototype.hasOwnProperty.call(message, "runId")) {
          desk.latestRunId = message.runId;
        }

        renderScene(currentScene);
      }

      function resolveDeskFromTarget(target) {
        const deskElement = getDeskFromEventTarget(target);
        if (!deskElement) {
          return null;
        }

        const deskId = deskElement.getAttribute("data-desk-id") || deskElement.getAttribute("data-desk-overlay");
        return deskId ? findDeskById(currentScene, deskId) : null;
      }

      function postDeskActionFromElement(element) {
        if (!(element instanceof Element)) {
          return false;
        }

        const providerButton = element.closest("[data-provider-id]");
        if (providerButton) {
          const deskId = providerButton.getAttribute("data-desk-id");
          const promptStem = providerButton.getAttribute("data-prompt-stem");
          const providerId = providerButton.getAttribute("data-provider-id");
          if (!deskId || !promptStem || !providerId) {
            return false;
          }

          postWebviewMessage({
            type: "AgentAssignRequested",
            deskId: deskId,
            promptStem: promptStem,
            providerId: providerId,
          });
          closeDeskMenu(false);
          return true;
        }

        const actionButton = element.closest("[data-prompt-action]");
        if (actionButton) {
          const deskId = actionButton.getAttribute("data-desk-id");
          const promptStem = actionButton.getAttribute("data-prompt-stem");
          const action = actionButton.getAttribute("data-prompt-action");
          if (!deskId || !promptStem || !action) {
            return false;
          }

          postWebviewMessage({
            type: "PromptActionRequested",
            deskId: deskId,
            promptStem: promptStem,
            action: action,
          });

          if (action !== "open_prompt" && action !== "open_output") {
            closeDeskMenu(false);
          }
          return true;
        }

        const dismissButton = element.closest("[data-dismiss-menu]");
        if (dismissButton) {
          closeDeskMenu(true);
          return true;
        }

        return false;
      }

      window.addEventListener("message", function (event) {
        const message = event.data;
        if (!message || typeof message !== "object") {
          return;
        }

        if (message.type === "SceneUpdate" && message.scene) {
          currentScene = message.scene;
          renderScene(currentScene);
          return;
        }

        if (message.type === "DeskStatusChange") {
          applyDeskStatusChange(message);
          return;
        }

        if (message.type === "AvatarTransition") {
          applyAvatarTransition(message);
        }
      });

      if (app) {
        app.addEventListener("click", function (event) {
          const target = event.target;
          if (postDeskActionFromElement(target)) {
            event.preventDefault();
            return;
          }

          const desk = resolveDeskFromTarget(target);
          if (desk) {
            event.preventDefault();
            openDeskMenu(desk, "primary");
            return;
          }

          if (selectedDeskId && !isWithinDeskContext(target, selectedDeskId)) {
            closeDeskMenu(false);
          }
        });

        app.addEventListener("contextmenu", function (event) {
          const desk = resolveDeskFromTarget(event.target);
          if (!desk) {
            return;
          }

          event.preventDefault();
          openDeskMenu(desk, "secondary");
        });

        app.addEventListener("keydown", function (event) {
          const target = event.target;

          if (event.key === "Escape") {
            if (selectedDeskId) {
              event.preventDefault();
              closeDeskMenu(true);
              return;
            }

            const focusedDesk = resolveDeskFromTarget(target);
            if (focusedDesk) {
              event.preventDefault();
              dismissDeskHover(focusedDesk);
            }
            return;
          }

          const desk = resolveDeskFromTarget(target);
          if (!desk) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDeskMenu(desk, "primary");
          }
        });

        app.addEventListener("focusin", function (event) {
          const desk = resolveDeskFromTarget(event.target);
          if (!desk) {
            return;
          }

          clearHoverDelay();
          setHoveredDesk(desk, true);
        });

        app.addEventListener("focusout", function (event) {
          const desk = resolveDeskFromTarget(event.target);
          if (!desk || isWithinDeskContext(event.relatedTarget, desk.id)) {
            return;
          }

          dismissDeskHover(desk);
        });

        app.addEventListener("mouseover", function (event) {
          const desk = resolveDeskFromTarget(event.target);
          if (!desk) {
            return;
          }

          const previousDesk = resolveDeskFromTarget(event.relatedTarget);
          if (previousDesk && previousDesk.id === desk.id) {
            return;
          }

          scheduleDeskHover(desk);
        });

        app.addEventListener("mouseout", function (event) {
          const desk = resolveDeskFromTarget(event.target);
          if (!desk || isWithinDeskContext(event.relatedTarget, desk.id)) {
            return;
          }

          dismissDeskHover(desk);
        });
      }

      try {
        currentScene = initialStateElement ? JSON.parse(initialStateElement.textContent || "null") : null;
        renderScene(currentScene);
      } catch (error) {
        if (app) {
          app.innerHTML = '<main class="shell"><section class="hud"><h1 class="hud__title">Pixel Room Render Error</h1><p>' +
            escapeHtml(error instanceof Error ? error.message : String(error)) +
            "</p></section></main>";
        }
      }
    </script>
  </body>
</html>`;
}
