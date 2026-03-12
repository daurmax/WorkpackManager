import {
  AVATAR_CANCELLED_LINGER_MS,
  AVATAR_COMPLETION_LINGER_MS,
  AVATAR_COMPLETION_TRAVEL_MS,
  AVATAR_FAILURE_LINGER_MS,
} from "./avatar-runtime";

export function buildAvatarRendererStyles(): string {
  return `
      .avatar-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .avatar {
        position: absolute;
        width: 24px;
        height: 32px;
        transform-origin: bottom center;
        image-rendering: pixelated;
        will-change: transform, opacity;
      }

      .avatar__sprite {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .avatar__head,
      .avatar__body,
      .avatar__arm,
      .avatar__legs,
      .avatar__hand,
      .avatar__shoe {
        position: absolute;
        border: 2px solid var(--outline);
      }

      .avatar__head {
        left: 6px;
        top: 0;
        width: 12px;
        height: 10px;
        background: #f1c58a;
      }

      .avatar__body {
        left: 7px;
        top: 10px;
        width: 10px;
        height: 11px;
        background: #5f92ff;
      }

      .avatar__arm {
        top: 11px;
        width: 4px;
        height: 10px;
        background: inherit;
      }

      .avatar__arm--left {
        left: 2px;
      }

      .avatar__arm--right {
        right: 2px;
      }

      .avatar__hand {
        top: 19px;
        width: 4px;
        height: 4px;
        background: #f1c58a;
      }

      .avatar__hand--left {
        left: 2px;
      }

      .avatar__hand--right {
        right: 2px;
      }

      .avatar__legs {
        left: 7px;
        top: 21px;
        width: 10px;
        height: 9px;
        background: #2d3d5e;
      }

      .avatar__shoe {
        top: 28px;
        width: 5px;
        height: 4px;
        background: #2a2026;
      }

      .avatar__shoe--left {
        left: 6px;
      }

      .avatar__shoe--right {
        right: 6px;
      }

      .avatar__badge {
        position: absolute;
        right: -10px;
        top: -10px;
        min-width: 14px;
        padding: 1px 3px;
        border: 2px solid var(--outline);
        background: var(--paper);
        color: var(--ink);
        font-size: 8px;
        line-height: 1;
        text-align: center;
        text-transform: uppercase;
      }

      .avatar__provider {
        position: absolute;
        left: 50%;
        bottom: -12px;
        transform: translateX(-50%);
        max-width: 44px;
        padding: 1px 3px;
        border: 2px solid var(--outline);
        background: rgba(36, 29, 47, 0.82);
        color: var(--paper);
        font-size: 8px;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .avatar--provider-copilot .avatar__body,
      .avatar--provider-copilot .avatar__arm,
      .avatar--provider-copilot .avatar__legs {
        background: #2fbca5;
      }

      .avatar--provider-codex .avatar__body,
      .avatar--provider-codex .avatar__arm,
      .avatar--provider-codex .avatar__legs {
        background: #5f92ff;
      }

      .avatar--provider-unassigned .avatar__body,
      .avatar--provider-unassigned .avatar__arm,
      .avatar--provider-unassigned .avatar__legs {
        background: #a091b2;
      }

      .avatar--working .avatar__sprite {
        animation: avatar-work 700ms steps(2, end) infinite;
      }

      .avatar--walking-to-board .avatar__sprite {
        animation: avatar-walk 280ms steps(2, end) infinite;
      }

      .avatar--pinning-output .avatar__sprite {
        animation: avatar-pin 900ms steps(2, end) infinite;
      }

      .avatar--hand-raised .avatar__arm--right,
      .avatar--hand-raised .avatar__hand--right {
        top: 4px;
        height: 15px;
      }

      .avatar--hand-raised .avatar__hand--right {
        top: 1px;
      }

      .avatar--leaving {
        opacity: 0.68;
        filter: saturate(0.75);
      }

      .avatar.status-human-input-required .avatar__badge {
        background: var(--attention);
      }

      .avatar.status-complete .avatar__badge {
        background: var(--complete);
      }

      .avatar.status-failed .avatar__badge,
      .avatar.status-cancelled .avatar__badge {
        background: var(--blocked);
        color: var(--paper);
      }

      .avatar.status-failed .avatar__sprite {
        filter: drop-shadow(0 0 8px rgba(226, 96, 104, 0.7));
      }

      .room--reduced-motion .avatar,
      .room--reduced-motion .avatar__sprite {
        animation: none !important;
        transition: none !important;
      }

      @keyframes avatar-work {
        0%,
        100% {
          transform: translateY(0);
        }

        50% {
          transform: translateY(-2px);
        }
      }

      @keyframes avatar-walk {
        0%,
        100% {
          transform: translateY(0);
        }

        50% {
          transform: translateY(-1px);
        }
      }

      @keyframes avatar-pin {
        0%,
        100% {
          transform: translateY(0);
        }

        35% {
          transform: translateY(-2px);
        }

        70% {
          transform: translateY(0);
        }
      }
  `;
}

export function buildAvatarRendererScript(): string {
  return `
      const avatarLifecycleTimers = new Map();
      let reducedMotionMediaQuery = null;
      let reducedMotionListenerBound = false;

      try {
        reducedMotionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      } catch (error) {
        reducedMotionMediaQuery = null;
      }

      function toAvatarStateClass(value) {
        return String(value || "idle").replaceAll("_", "-");
      }

      function getAvatarProviderClass(providerId) {
        const normalized = String(providerId || "unassigned").trim().toLowerCase();
        return normalized.length > 0 ? normalized.replaceAll(/[^a-z0-9-]/g, "-") : "unassigned";
      }

      function getAvatarBadgeText(avatar) {
        if (!avatar || !avatar.run) {
          return "";
        }

        if (isReducedMotionEnabled()) {
          if (avatar.run.status === "queued") {
            return "Q";
          }

          if (avatar.run.status === "in_progress") {
            return "...";
          }
        }

        if (avatar.run.status === "human_input_required") {
          return "!";
        }

        if (avatar.run.status === "complete") {
          return "+";
        }

        if (avatar.run.status === "failed") {
          return "X";
        }

        if (avatar.run.status === "cancelled") {
          return "-";
        }

        return "";
      }

      function getAvatarClassName(avatar) {
        return [
          "avatar",
          "status-" + toStatusClass(avatar.run ? avatar.run.status : "unknown"),
          "avatar--" + toAvatarStateClass(avatar.animationState),
          "avatar--facing-" + String(avatar.facing || "up"),
          "avatar--provider-" + getAvatarProviderClass(avatar.providerId),
        ].join(" ");
      }

      function buildAvatarInnerMarkup(avatar) {
        const badgeText = getAvatarBadgeText(avatar);
        const badgeMarkup = badgeText
          ? '<span class="avatar__badge">' + escapeHtml(badgeText) + "</span>"
          : "";
        const providerMarkup = avatar.providerId
          ? '<span class="avatar__provider">' + escapeHtml(avatar.providerId) + "</span>"
          : "";

        return [
          '<div class="avatar__sprite">',
          '<span class="avatar__head"></span>',
          '<span class="avatar__body"></span>',
          '<span class="avatar__arm avatar__arm--left"></span>',
          '<span class="avatar__arm avatar__arm--right"></span>',
          '<span class="avatar__hand avatar__hand--left"></span>',
          '<span class="avatar__hand avatar__hand--right"></span>',
          '<span class="avatar__legs"></span>',
          '<span class="avatar__shoe avatar__shoe--left"></span>',
          '<span class="avatar__shoe avatar__shoe--right"></span>',
          "</div>",
          badgeMarkup,
          providerMarkup,
        ].join("");
      }

      function buildAvatarMarkup(avatar) {
        const zIndex = avatar.position && typeof avatar.position.z === "number"
          ? avatar.position.z
          : avatar.position.y;

        return [
          '<div class="',
          getAvatarClassName(avatar),
          '" data-avatar-id="',
          escapeHtml(avatar.id),
          '" data-run-id="',
          escapeHtml(avatar.runId),
          '" data-avatar-state="',
          escapeHtml(avatar.animationState),
          '" style="left:',
          String(avatar.position.x),
          "px; top:",
          String(avatar.position.y),
          "px; z-index:",
          String(zIndex),
          ';">',
          buildAvatarInnerMarkup(avatar),
          "</div>",
        ].join("");
      }

      function buildAvatarLayerMarkup(scene) {
        if (!scene || !scene.room || !Array.isArray(scene.room.avatars)) {
          return "";
        }

        return scene.room.avatars.map(buildAvatarMarkup).join("");
      }

      function getAvatarLayerElement() {
        return app ? app.querySelector("[data-avatar-layer]") : null;
      }

      function getCurrentAvatar(avatarId) {
        if (!currentScene || !currentScene.room || !Array.isArray(currentScene.room.avatars)) {
          return null;
        }

        return currentScene.room.avatars.find(function (avatar) {
          return avatar.id === avatarId;
        }) || null;
      }

      function findAvatarIndex(avatarId) {
        if (!currentScene || !currentScene.room || !Array.isArray(currentScene.room.avatars)) {
          return -1;
        }

        return currentScene.room.avatars.findIndex(function (avatar) {
          return avatar.id === avatarId;
        });
      }

      function clearAvatarTimers(avatarId) {
        const existing = avatarLifecycleTimers.get(avatarId);
        if (!existing) {
          return;
        }

        if (existing.pin) {
          clearTimeout(existing.pin);
        }

        if (existing.remove) {
          clearTimeout(existing.remove);
        }

        avatarLifecycleTimers.delete(avatarId);
      }

      function setAvatarTimer(avatarId, kind, timerId) {
        const existing = avatarLifecycleTimers.get(avatarId) || {};
        if (kind === "pin" && existing.pin) {
          clearTimeout(existing.pin);
        }
        if (kind === "remove" && existing.remove) {
          clearTimeout(existing.remove);
        }

        existing[kind] = timerId;
        avatarLifecycleTimers.set(avatarId, existing);
      }

      function clearStaleAvatarTimers() {
        const activeIds = new Set(
          currentScene && currentScene.room && Array.isArray(currentScene.room.avatars)
            ? currentScene.room.avatars.map(function (avatar) {
              return avatar.id;
            })
            : [],
        );

        Array.from(avatarLifecycleTimers.keys()).forEach(function (avatarId) {
          if (!activeIds.has(avatarId)) {
            clearAvatarTimers(avatarId);
          }
        });
      }

      function isReducedMotionEnabled() {
        return Boolean(currentScene && currentScene.reducedMotion) ||
          Boolean(reducedMotionMediaQuery && reducedMotionMediaQuery.matches);
      }

      function updateRoomMotionClass() {
        const room = app ? app.querySelector("[data-room]") : null;
        if (!room) {
          return;
        }

        room.classList.toggle("room--reduced-motion", isReducedMotionEnabled());
      }

      function renderAvatarLayer() {
        const avatarLayer = getAvatarLayerElement();
        if (!avatarLayer) {
          return;
        }

        avatarLayer.innerHTML = buildAvatarLayerMarkup(currentScene);
        updateRoomMotionClass();
        syncAvatarLifecycleTimers();
      }

      function removeAvatarById(avatarId) {
        const avatarIndex = findAvatarIndex(avatarId);
        if (avatarIndex < 0 || !currentScene || !currentScene.room) {
          clearAvatarTimers(avatarId);
          return;
        }

        currentScene.room.avatars.splice(avatarIndex, 1);
        clearAvatarTimers(avatarId);
        renderAvatarLayer();
      }

      function scheduleAvatarRemoval(avatarId, delayMs) {
        const safeDelay = Math.max(0, Number(delayMs) || 0);

        if (safeDelay === 0) {
          removeAvatarById(avatarId);
          return;
        }

        setAvatarTimer(avatarId, "remove", setTimeout(function () {
          removeAvatarById(avatarId);
        }, safeDelay));
      }

      function scheduleAvatarLifecycle(avatar) {
        if (!avatar || !avatar.run) {
          return;
        }

        clearAvatarTimers(avatar.id);

        if (avatar.run.status !== "complete" && avatar.run.status !== "failed" && avatar.run.status !== "cancelled") {
          return;
        }

        const completedAt = avatar.run.completedAt ? Date.parse(avatar.run.completedAt) : NaN;
        if (!Number.isFinite(completedAt)) {
          return;
        }

        const elapsed = Math.max(0, Date.now() - completedAt);

        if (avatar.run.status === "complete") {
          const pinDelay = Math.max(0, ${AVATAR_COMPLETION_TRAVEL_MS} - elapsed);
          const removeDelay = Math.max(0, ${AVATAR_COMPLETION_TRAVEL_MS + AVATAR_COMPLETION_LINGER_MS} - elapsed);

          if (avatar.animationState === "walking_to_board" && pinDelay > 0) {
            setAvatarTimer(avatar.id, "pin", setTimeout(function () {
              const currentAvatar = getCurrentAvatar(avatar.id);
              if (!currentAvatar || currentAvatar.animationState !== "walking_to_board") {
                return;
              }

              currentAvatar.animationState = "pinning_output";
              renderAvatarLayer();
            }, pinDelay));
          }

          scheduleAvatarRemoval(avatar.id, removeDelay);
          return;
        }

        if (avatar.run.status === "failed") {
          scheduleAvatarRemoval(avatar.id, Math.max(0, ${AVATAR_FAILURE_LINGER_MS} - elapsed));
          return;
        }

        scheduleAvatarRemoval(avatar.id, Math.max(0, ${AVATAR_CANCELLED_LINGER_MS} - elapsed));
      }

      function syncAvatarLifecycleTimers() {
        clearStaleAvatarTimers();

        if (!currentScene || !currentScene.room || !Array.isArray(currentScene.room.avatars)) {
          return;
        }

        currentScene.room.avatars.forEach(function (avatar) {
          scheduleAvatarLifecycle(avatar);
        });
      }

      function bindReducedMotionListener() {
        if (reducedMotionListenerBound || !reducedMotionMediaQuery) {
          return;
        }

        const rerender = function () {
          if (!currentScene) {
            return;
          }

          renderAvatarLayer();
        };

        if (typeof reducedMotionMediaQuery.addEventListener === "function") {
          reducedMotionMediaQuery.addEventListener("change", rerender);
        } else if (typeof reducedMotionMediaQuery.addListener === "function") {
          reducedMotionMediaQuery.addListener(rerender);
        }

        reducedMotionListenerBound = true;
      }

      function applyAvatarElementMarkup(element, avatar) {
        element.className = getAvatarClassName(avatar);
        element.setAttribute("data-avatar-id", avatar.id);
        element.setAttribute("data-run-id", avatar.runId);
        element.setAttribute("data-avatar-state", avatar.animationState);
        element.style.left = String(avatar.position.x) + "px";
        element.style.top = String(avatar.position.y) + "px";
        element.style.zIndex = String(
          avatar.position && typeof avatar.position.z === "number" ? avatar.position.z : avatar.position.y,
        );
        element.style.opacity = "";
        element.style.transition = "";
        element.style.transform = "";
        element.innerHTML = buildAvatarInnerMarkup(avatar);
      }

      function applyAvatarTransition(message) {
        if (!message || !message.avatar || !currentScene || !currentScene.room) {
          return;
        }

        bindReducedMotionListener();

        const nextAvatar = message.avatar;
        const previousIndex = findAvatarIndex(nextAvatar.id);
        const previousAvatar = previousIndex >= 0 ? currentScene.room.avatars[previousIndex] : null;

        if (previousIndex >= 0) {
          currentScene.room.avatars[previousIndex] = nextAvatar;
        } else {
          currentScene.room.avatars.push(nextAvatar);
        }

        if (isReducedMotionEnabled()) {
          if (nextAvatar.animationState === "walking_to_board") {
            const reducedAvatar = getCurrentAvatar(nextAvatar.id);
            if (reducedAvatar) {
              reducedAvatar.animationState = "pinning_output";
            }
          }

          renderAvatarLayer();
          if (typeof message.removeAfterMs === "number") {
            scheduleAvatarRemoval(nextAvatar.id, message.removeAfterMs);
          }
          return;
        }

        const avatarLayer = getAvatarLayerElement();
        if (!avatarLayer || !previousAvatar) {
          renderAvatarLayer();
          if (typeof message.removeAfterMs === "number") {
            scheduleAvatarRemoval(nextAvatar.id, message.removeAfterMs);
          }
          return;
        }

        const element = avatarLayer.querySelector('[data-avatar-id="' + nextAvatar.id + '"]');
        if (!(element instanceof HTMLElement)) {
          renderAvatarLayer();
          if (typeof message.removeAfterMs === "number") {
            scheduleAvatarRemoval(nextAvatar.id, message.removeAfterMs);
          }
          return;
        }

        applyAvatarElementMarkup(element, nextAvatar);
        element.style.left = String(previousAvatar.position.x) + "px";
        element.style.top = String(previousAvatar.position.y) + "px";

        if (nextAvatar.animationState === "walking_to_board") {
          const deltaX = nextAvatar.position.x - previousAvatar.position.x;
          const deltaY = nextAvatar.position.y - previousAvatar.position.y;
          element.style.transition = "transform ${AVATAR_COMPLETION_TRAVEL_MS}ms steps(8, end)";

          requestAnimationFrame(function () {
            element.style.transform = "translate(" + String(deltaX) + "px, " + String(deltaY) + "px)";
          });

          scheduleAvatarLifecycle(nextAvatar);
          return;
        }

        if (nextAvatar.animationState === "leaving") {
          element.style.transition = "transform 220ms steps(2, end), opacity 220ms linear";

          requestAnimationFrame(function () {
            element.style.transform = "translate(14px, 4px)";
            element.style.opacity = "0";
          });

          if (typeof message.removeAfterMs === "number") {
            scheduleAvatarRemoval(nextAvatar.id, message.removeAfterMs);
          } else {
            scheduleAvatarLifecycle(nextAvatar);
          }

          return;
        }

        renderAvatarLayer();
      }
  `;
}
