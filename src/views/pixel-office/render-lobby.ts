import type * as vscode from "vscode";
import type { LobbySceneState } from "../../models/pixel-office";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusClass(status: string): string {
  return status.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}

function buildDoorMarkup(door: {
  workpackId: string;
  title: string;
  category: string;
  overallStatus: string;
  promptCount: number;
  completedCount: number;
}): string {
  const progress =
    door.promptCount > 0
      ? Math.round((door.completedCount / door.promptCount) * 100)
      : 0;
  const progressWidth = Math.max(4, progress);

  return [
    '<button type="button" class="door door--',
    statusClass(door.overallStatus),
    '" data-workpack-id="',
    escapeHtml(door.workpackId),
    '" title="',
    escapeHtml(door.title),
    '">',
    '<div class="door__frame"></div>',
    '<div class="door__label">',
    escapeHtml(door.title),
    "</div>",
    '<div class="door__meta">',
    '<span class="door__chip door__chip--category">',
    escapeHtml(door.category),
    "</span>",
    '<span class="door__chip door__chip--status status-',
    statusClass(door.overallStatus),
    '">',
    escapeHtml(door.overallStatus.replace(/_/g, " ")),
    "</span>",
    "</div>",
    '<div class="door__progress-bar"><div class="door__progress-fill" style="width:',
    String(progressWidth),
    '%"></div></div>',
    '<div class="door__progress-text">',
    String(door.completedCount),
    "/",
    String(door.promptCount),
    "</div>",
    "</button>",
  ].join("");
}

export function buildLobbyHtml(
  _webview: vscode.Webview,
  scene: LobbySceneState,
): string {
  const groupSections = scene.groups
    .map((group) => {
      const doors = group.doors.map(buildDoorMarkup).join("");
      return [
        '<section class="group">',
        '<h2 class="group__title">',
        escapeHtml(group.label),
        ' <span class="group__count">(',
        String(group.doors.length),
        ")</span></h2>",
        '<div class="group__grid">',
        doors,
        "</div>",
        "</section>",
      ].join("");
    })
    .join("");

  const ungroupedSection =
    scene.ungrouped.length > 0
      ? [
          '<section class="group">',
          '<h2 class="group__title">Standalone Workpacks',
          ' <span class="group__count">(',
          String(scene.ungrouped.length),
          ")</span></h2>",
          '<div class="group__grid">',
          scene.ungrouped.map(buildDoorMarkup).join(""),
          "</div>",
          "</section>",
        ].join("")
      : "";

  const maskedApiKey = scene.settings.codexApiKey
    ? "••••" + scene.settings.codexApiKey.slice(-4)
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pixel Office Lobby</title>
    <style>
      :root {
        --bg: #16121f;
        --surface: #1e1a2e;
        --surface-raised: #262240;
        --border: #3a3560;
        --text: #e8e4f0;
        --text-muted: #9890b0;
        --accent: #7c6ff0;
        --accent-hover: #9488f8;
        --success: #4caf50;
        --warning: #ff9800;
        --error: #f44336;
        --info: #42a5f5;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: var(--vscode-font-family, "Segoe UI", system-ui, sans-serif);
        font-size: 13px;
        color: var(--text);
        background: var(--bg);
        padding: 0;
        overflow-x: hidden;
      }

      .lobby {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px 20px;
      }

      .lobby__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 2px solid var(--border);
      }

      .lobby__title {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
        image-rendering: pixelated;
        color: var(--accent);
      }

      .lobby__subtitle {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 2px;
      }

      .lobby__stats {
        font-size: 12px;
        color: var(--text-muted);
        text-align: right;
      }

      .lobby__nav {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
      }

      .lobby__tab {
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--text-muted);
        background: var(--surface);
        border: 2px solid var(--border);
        cursor: pointer;
        transition: all 0.15s;
      }

      .lobby__tab:hover {
        border-color: var(--accent);
        color: var(--text);
      }

      .lobby__tab--active {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      /* --- Room Sections --- */
      .group {
        margin-bottom: 24px;
      }

      .group__title {
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--text);
        margin-bottom: 12px;
        padding-left: 4px;
        border-left: 3px solid var(--accent);
        padding-left: 10px;
      }

      .group__count {
        font-weight: 400;
        color: var(--text-muted);
        font-size: 12px;
      }

      .group__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
      }

      /* --- Door Cards --- */
      .door {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 14px 10px 10px;
        background: var(--surface);
        border: 2px solid var(--border);
        cursor: pointer;
        text-align: center;
        font-family: inherit;
        color: inherit;
        transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
        position: relative;
      }

      .door:hover {
        border-color: var(--accent);
        box-shadow: 0 0 12px rgba(124, 111, 240, 0.25);
        transform: translateY(-2px);
      }

      .door:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .door__frame {
        width: 48px;
        height: 56px;
        border: 3px solid var(--border);
        background: var(--surface-raised);
        margin-bottom: 8px;
        position: relative;
        image-rendering: pixelated;
      }

      .door__frame::after {
        content: "";
        position: absolute;
        width: 6px;
        height: 6px;
        background: var(--text-muted);
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        border-radius: 50%;
      }

      .door--complete .door__frame {
        border-color: var(--success);
      }

      .door--complete .door__frame::after {
        background: var(--success);
      }

      .door--in-progress .door__frame,
      .door--running .door__frame {
        border-color: var(--info);
      }

      .door--in-progress .door__frame::after,
      .door--running .door__frame::after {
        background: var(--info);
      }

      .door--blocked .door__frame,
      .door--failed .door__frame {
        border-color: var(--error);
      }

      .door--blocked .door__frame::after,
      .door--failed .door__frame::after {
        background: var(--error);
      }

      .door__label {
        font-size: 11px;
        font-weight: 600;
        margin-bottom: 6px;
        line-height: 1.3;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .door__meta {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        justify-content: center;
        margin-bottom: 6px;
      }

      .door__chip {
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 1px 5px;
        border: 1px solid var(--border);
        color: var(--text-muted);
      }

      .door__chip--status.status-complete {
        border-color: var(--success);
        color: var(--success);
      }

      .door__chip--status.status-in-progress,
      .door__chip--status.status-running {
        border-color: var(--info);
        color: var(--info);
      }

      .door__chip--status.status-blocked,
      .door__chip--status.status-failed {
        border-color: var(--error);
        color: var(--error);
      }

      .door__progress-bar {
        width: 100%;
        height: 4px;
        background: var(--surface-raised);
        border: 1px solid var(--border);
        margin-bottom: 2px;
        overflow: hidden;
      }

      .door__progress-fill {
        height: 100%;
        background: var(--accent);
        transition: width 0.3s;
      }

      .door--complete .door__progress-fill {
        background: var(--success);
      }

      .door__progress-text {
        font-size: 10px;
        color: var(--text-muted);
      }

      /* --- Settings Panel --- */
      .settings-panel {
        display: none;
      }

      .settings-panel--visible {
        display: block;
      }

      .rooms-panel {
        display: block;
      }

      .rooms-panel--hidden {
        display: none;
      }

      .settings {
        max-width: 560px;
      }

      .settings__section {
        margin-bottom: 24px;
      }

      .settings__section-title {
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--accent);
        margin-bottom: 12px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--border);
      }

      .settings__row {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 14px;
      }

      .settings__label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
      }

      .settings__hint {
        font-size: 11px;
        color: var(--text-muted);
      }

      .settings__input {
        width: 100%;
        padding: 6px 10px;
        font-size: 13px;
        font-family: var(--vscode-editor-font-family, monospace);
        color: var(--text);
        background: var(--surface-raised);
        border: 2px solid var(--border);
        outline: none;
        transition: border-color 0.15s;
      }

      .settings__input:focus {
        border-color: var(--accent);
      }

      .settings__input--masked {
        letter-spacing: 2px;
      }

      .settings__button {
        padding: 6px 16px;
        font-size: 12px;
        font-weight: 600;
        color: #fff;
        background: var(--accent);
        border: 2px solid var(--accent);
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: background 0.15s;
        margin-top: 4px;
      }

      .settings__button:hover {
        background: var(--accent-hover);
      }

      .settings__saved {
        display: none;
        font-size: 11px;
        color: var(--success);
        margin-left: 8px;
      }

      .settings__saved--visible {
        display: inline;
      }

      .settings__actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* --- Empty State --- */
      .empty-state {
        text-align: center;
        padding: 48px 16px;
        color: var(--text-muted);
      }

      .empty-state__icon {
        font-size: 32px;
        margin-bottom: 12px;
      }

      .empty-state__text {
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="lobby">
      <header class="lobby__header">
        <div>
          <h1 class="lobby__title">&#x1F3E2; Pixel Office</h1>
          <p class="lobby__subtitle">Main Lobby</p>
        </div>
        <div class="lobby__stats">${scene.totalWorkpacks} workpack${scene.totalWorkpacks === 1 ? "" : "s"}</div>
      </header>

      <nav class="lobby__nav">
        <button type="button" class="lobby__tab lobby__tab--active" data-tab="rooms">Rooms</button>
        <button type="button" class="lobby__tab" data-tab="settings">Settings</button>
      </nav>

      <div class="rooms-panel" id="rooms-panel">
        ${groupSections}${ungroupedSection}${
    scene.totalWorkpacks === 0
      ? '<div class="empty-state"><div class="empty-state__icon">&#x1F6AA;</div><p class="empty-state__text">No workpacks discovered yet.<br/>Create a workpack to see it here.</p></div>'
      : ""
  }
      </div>

      <div class="settings-panel" id="settings-panel">
        <div class="settings">
          <section class="settings__section">
            <h3 class="settings__section-title">Codex (OpenAI) Provider</h3>
            <div class="settings__row">
              <label class="settings__label" for="codex-api-key">API Key</label>
              <span class="settings__hint">Stored in VS Code settings. Falls back to OPENAI_API_KEY env var.</span>
              <input type="password" id="codex-api-key" class="settings__input settings__input--masked"
                     placeholder="sk-..." value="${escapeHtml(maskedApiKey)}" autocomplete="off" />
            </div>
            <div class="settings__row">
              <label class="settings__label" for="codex-base-url">Base URL</label>
              <input type="text" id="codex-base-url" class="settings__input"
                     value="${escapeHtml(scene.settings.codexBaseUrl)}" />
            </div>
            <div class="settings__row">
              <label class="settings__label" for="codex-model">Model</label>
              <input type="text" id="codex-model" class="settings__input"
                     value="${escapeHtml(scene.settings.codexModel)}" />
            </div>
          </section>
          <section class="settings__section">
            <h3 class="settings__section-title">Copilot Provider</h3>
            <div class="settings__row">
              <label class="settings__label" for="copilot-max-tokens">Max Prompt Tokens</label>
              <input type="number" id="copilot-max-tokens" class="settings__input"
                     value="${String(scene.settings.copilotMaxPromptTokens)}" min="256" step="256" />
            </div>
          </section>
          <div class="settings__actions">
            <button type="button" id="save-settings" class="settings__button">Save Settings</button>
            <span id="settings-saved" class="settings__saved">Saved!</span>
          </div>
        </div>
      </div>
    </div>

    <script id="initial-state" type="application/json">${JSON.stringify(scene)}</script>
    <script>
      (function () {
        var vscodeApi = acquireVsCodeApi();
        var tabs = document.querySelectorAll("[data-tab]");
        var roomsPanel = document.getElementById("rooms-panel");
        var settingsPanel = document.getElementById("settings-panel");

        tabs.forEach(function (tab) {
          tab.addEventListener("click", function () {
            var target = tab.getAttribute("data-tab");
            tabs.forEach(function (t) {
              t.classList.toggle("lobby__tab--active", t === tab);
            });
            roomsPanel.classList.toggle("rooms-panel--hidden", target === "settings");
            settingsPanel.classList.toggle("settings-panel--visible", target === "settings");
          });
        });

        document.addEventListener("click", function (event) {
          var door = event.target.closest("[data-workpack-id]");
          if (door) {
            vscodeApi.postMessage({
              type: "OpenRoom",
              workpackId: door.getAttribute("data-workpack-id"),
            });
            return;
          }
        });

        var saveButton = document.getElementById("save-settings");
        var savedLabel = document.getElementById("settings-saved");
        if (saveButton) {
          saveButton.addEventListener("click", function () {
            var apiKeyInput = document.getElementById("codex-api-key");
            var rawKey = apiKeyInput ? apiKeyInput.value : "";
            var isPlaceholder = /^[•]+/.test(rawKey);

            vscodeApi.postMessage({
              type: "SaveSettings",
              settings: {
                codexApiKey: isPlaceholder ? null : rawKey,
                codexBaseUrl: document.getElementById("codex-base-url").value,
                codexModel: document.getElementById("codex-model").value,
                copilotMaxPromptTokens: Number(document.getElementById("copilot-max-tokens").value) || 8192,
              },
            });

            savedLabel.classList.add("settings__saved--visible");
            setTimeout(function () {
              savedLabel.classList.remove("settings__saved--visible");
            }, 2000);
          });
        }

        window.addEventListener("message", function (event) {
          var message = event.data;
          if (message && message.type === "LobbySceneUpdate" && message.scene) {
            vscodeApi.setState(message.scene);
          }
        });
      })();
    </script>
  </body>
</html>`;
}
