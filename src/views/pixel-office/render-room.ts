import type * as vscode from "vscode";
import type { SceneState } from "../../models/pixel-office";

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
        color-scheme: dark;
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
        --pending: #d1b06a;
        --active: #5f92ff;
        --complete: #63bf73;
        --blocked: #e26068;
        --muted: #9a90a3;
        --attention: #f0a03d;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        background:
          radial-gradient(circle at top, rgba(140, 197, 255, 0.18), transparent 30%),
          linear-gradient(180deg, #15121d 0%, #0f0c16 100%);
        color: var(--paper);
        font-family: "Courier New", monospace;
      }

      body {
        min-height: 100vh;
      }

      .shell {
        display: grid;
        gap: 20px;
        min-height: 100vh;
        padding: 24px;
      }

      .hud,
      .legend {
        border: 4px solid var(--outline);
        background: rgba(36, 29, 47, 0.94);
        box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.28);
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
        background: var(--wood);
        box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.18);
        color: var(--paper);
        padding: 10px 10px 8px;
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
        font-size: 9px;
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
        font-size: 9px;
        text-transform: uppercase;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script id="pixel-room-state" type="application/json">${serializedScene}</script>
    <script nonce="${nonce}">
      const app = document.getElementById("app");
      const initialStateElement = document.getElementById("pixel-room-state");
      let currentScene = null;

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

      function buildDeskMarkup(desk) {
        const statusClass = toStatusClass(desk.status);
        const agentMarkup = desk.assignedAgentId
          ? '<span class="desk__agent">' + escapeHtml(desk.assignedAgentId) + "</span>"
          : "";
        const dependsOn = Array.isArray(desk.dependsOn) && desk.dependsOn.length > 0
          ? "Depends on: " + desk.dependsOn.join(", ")
          : "Ready from start";

        return [
          '<article class="desk status-',
          statusClass,
          '" data-desk-id="',
          escapeHtml(desk.id),
          '" style="left:',
          String(desk.position.x),
          "px; top:",
          String(desk.position.y),
          "px; width:",
          String(desk.dimensions.width),
          "px; height:",
          String(desk.dimensions.height),
          'px;" title="',
          escapeHtml(dependsOn),
          '">',
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
          "</article>",
        ].join("");
      }

      function renderScene(scene) {
        if (!app || !scene || !scene.room) {
          return;
        }

        const desks = Array.isArray(scene.room.desks) ? scene.room.desks : [];
        const stations = Array.isArray(scene.room.stations) ? scene.room.stations : [];
        const completed = countMatchingStatuses(desks, ["complete", "skipped"]);
        const active = countMatchingStatuses(desks, ["queued", "in_progress", "human_input_required"]);
        const blocked = countMatchingStatuses(desks, ["blocked", "failed", "cancelled"]);
        const stationMarkup = stations.map(buildStationMarkup).join("");
        const deskMarkup = desks.map(buildDeskMarkup).join("");
        const overallStatusClass = toStatusClass(scene.room.overallStatus);

        app.innerHTML = [
          '<main class="shell">',
          '<section class="hud">',
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
          "</section>",
          '<section class="viewport">',
          '<div class="room" style="width:',
          String(scene.room.dimensions.width),
          "px; height:",
          String(scene.room.dimensions.height),
          'px;">',
          stationMarkup,
          deskMarkup,
          "</div>",
          "</section>",
          '<section class="legend">',
          '<span class="legend__chip status-pending">Pending</span>',
          '<span class="legend__chip status-in-progress">In Progress</span>',
          '<span class="legend__chip status-complete">Complete</span>',
          '<span class="legend__chip status-blocked">Blocked</span>',
          '<span class="legend__chip status-human-input-required">Needs Input</span>',
          "</section>",
          "</main>",
        ].join("");
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
        if (typeof message.assignedAgentId === "string") {
          desk.assignedAgentId = message.assignedAgentId;
        }
        if (typeof message.runId === "string") {
          desk.latestRunId = message.runId;
        }

        renderScene(currentScene);
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
        }
      });

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
