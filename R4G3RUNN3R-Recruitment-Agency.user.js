// ==UserScript==
// @name         R4G3RUNN3R's Recruitment Agency
// @namespace    r4g3runn3r.recruitment.agency
// @version      4.5.4
// @description  Recruitment discovery, candidate pipeline, Scout intelligence and local recruitment workflow for Torn.
// @author       R4G3RUNN3R[3877028]
// @license      MIT
// @match        https://www.torn.com/*
// @noframes
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/9b22dc3478d7d57dba6ff3354681767b35cf0ba6/src/scout-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/9b22dc3478d7d57dba6ff3354681767b35cf0ba6/src/results-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/9b22dc3478d7d57dba6ff3354681767b35cf0ba6/src/global-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/9b22dc3478d7d57dba6ff3354681767b35cf0ba6/src/match-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/9b22dc3478d7d57dba6ff3354681767b35cf0ba6/src/forum-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/9b22dc3478d7d57dba6ff3354681767b35cf0ba6/src/v45-runtime.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/9b22dc3478d7d57dba6ff3354681767b35cf0ba6/src/v45-candidates.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/9b22dc3478d7d57dba6ff3354681767b35cf0ba6/src/v45-discovery.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/9b22dc3478d7d57dba6ff3354681767b35cf0ba6/src/v45-messaging.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/9b22dc3478d7d57dba6ff3354681767b35cf0ba6/src/v45-app.js
// @downloadURL  https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/R4G3RUNN3R-Recruitment-Agency.user.js
// @updateURL    https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/R4G3RUNN3R-Recruitment-Agency.user.js
// ==/UserScript==

(() => {
  'use strict';
  const INSTALLER_VERSION = '4.5.4';
  const EXPECTED_APP_VERSION = '4.5.0';
  const DOM_GUARD = 'data-r4g3-ra-v45-owner';
  const RA_ROOT_SELECTOR = '#ra-app,#ra-hover,#ra-context,#ra-help-popover';
  const SHELL_STYLE_ID = 'ra-v454-shell-css';
  const shellUiState = {maximized:false, restoreGeometry:null, navObserver:null};

  if (window.top !== window.self) return;

  const root = document.documentElement;
  if (root.hasAttribute(DOM_GUARD)) return;
  root.setAttribute(DOM_GUARD, INSTALLER_VERSION);

  function clearDomGuard() {
    if (root.getAttribute(DOM_GUARD) === INSTALLER_VERSION) root.removeAttribute(DOM_GUARD);
  }

  function removeLegacyRecruitmentUi() {
    for (const id of ['ra-styles','ra-panel','ra-results-panel','ra-config-modal','ra-dock-fallback','ra-launcher']) {
      document.getElementById(id)?.remove();
    }
    document.querySelectorAll('.ra-dock-icon').forEach(node => node.remove());
  }

  function isRecruitmentElement(target) {
    return !!(target && typeof target.closest === 'function' && target.closest(RA_ROOT_SELECTOR));
  }

  function installClickListenerBridge() {
    if (window.__R4G3_RA_CLICK_BRIDGE__) return window.__R4G3_RA_CLICK_BRIDGE__;

    const registry = new WeakMap();
    const nativeAdd = EventTarget.prototype.addEventListener;
    const nativeRemove = EventTarget.prototype.removeEventListener;
    const captureFlag = options => typeof options === 'boolean' ? options : !!options?.capture;

    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === 'click' && listener && isRecruitmentElement(this)) {
        const capture = captureFlag(options);
        const entries = registry.get(this) || [];
        if (!entries.some(entry => entry.listener === listener && entry.capture === capture)) {
          entries.push({listener, capture, once:!!(options && typeof options === 'object' && options.once), options});
          registry.set(this, entries);
        }
      }
      return nativeAdd.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      if (type === 'click' && listener && registry.has(this)) {
        const capture = captureFlag(options);
        const remaining = registry.get(this).filter(entry => entry.listener !== listener || entry.capture !== capture);
        if (remaining.length) registry.set(this, remaining);
        else registry.delete(this);
      }
      return nativeRemove.call(this, type, listener, options);
    };

    const reportFailure = error => {
      console.error(`[RA] ${INSTALLER_VERSION} bridged click handler failed.`, error);
      try { alert(`Recruitment Agency click failed: ${error?.message || error}`); } catch {}
    };

    const bridge = {
      has(action) {
        return !!(action && (typeof action.onclick === 'function' || (registry.get(action)?.length)));
      },
      invoke(action, event) {
        let handled = false;
        if (typeof action.onclick === 'function') {
          handled = true;
          try {
            const result = action.onclick.call(action, event);
            if (result && typeof result.then === 'function') result.catch(reportFailure);
          } catch (error) {
            reportFailure(error);
          }
        }

        const entries = [...(registry.get(action) || [])];
        for (const entry of entries) {
          handled = true;
          try {
            const result = typeof entry.listener === 'function'
              ? entry.listener.call(action, event)
              : entry.listener?.handleEvent?.(event);
            if (result && typeof result.then === 'function') result.catch(reportFailure);
          } catch (error) {
            reportFailure(error);
          }
          if (entry.once) nativeRemove.call(action, 'click', entry.listener, entry.options);
        }
        return handled;
      }
    };

    window.__R4G3_RA_CLICK_BRIDGE__ = bridge;
    return bridge;
  }

  function installPrimaryInputShield(clickBridge) {
    if (window.__R4G3_RA_INPUT_SHIELD__) return;
    window.__R4G3_RA_INPUT_SHIELD__ = true;

    window.addEventListener('click', event => {
      try {
        if (event.defaultPrevented || event.button > 0) return;
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;

        const raRoot = target.closest(RA_ROOT_SELECTOR);
        if (!raRoot) return;

        const action = target.closest('button,a,[role="button"]');
        if (!action || !raRoot.contains(action) || action.disabled || !clickBridge.has(action)) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        clickBridge.invoke(action, event);
      } catch (error) {
        console.error(`[RA] ${INSTALLER_VERSION} primary click handler failed.`, error);
        try {
          alert(`Recruitment Agency click failed: ${error?.message || error}`);
        } catch {}
      }
    }, true);
  }

  function installShellResizeGuard() {
    const NativeResizeObserver = window.ResizeObserver;
    if (typeof NativeResizeObserver !== 'function') return () => {};

    class RecruitmentResizeObserver {
      constructor(callback) {
        this._native = new NativeResizeObserver((entries) => {
          const allowed = entries.filter(entry => !(entry.target?.id === 'ra-app' && entry.target.classList?.contains('ra-maximized')));
          if (allowed.length) callback(allowed, this);
        });
      }
      observe(...args) { return this._native.observe(...args); }
      unobserve(...args) { return this._native.unobserve(...args); }
      disconnect(...args) { return this._native.disconnect(...args); }
      takeRecords(...args) { return this._native.takeRecords?.(...args) || []; }
    }

    window.ResizeObserver = RecruitmentResizeObserver;
    return () => {
      if (window.ResizeObserver === RecruitmentResizeObserver) window.ResizeObserver = NativeResizeObserver;
    };
  }

  function installMaximizedDragGuard() {
    if (window.__R4G3_RA_MAX_DRAG_GUARD__) return;
    window.__R4G3_RA_MAX_DRAG_GUARD__ = true;
    window.addEventListener('pointerdown', event => {
      const target = event.target;
      if (!target || typeof target.closest !== 'function' || target.closest('button')) return;
      const titlebar = target.closest('#ra-titlebar');
      if (!titlebar || !titlebar.closest('#ra-app.ra-maximized')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function injectShellStyles() {
    if (document.getElementById(SHELL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SHELL_STYLE_ID;
    style.textContent = `
#ra-app .ra-shell{min-height:0!important}
#ra-app .ra-main{min-height:0!important;overflow:hidden!important}
#ra-app .ra-pagehead{flex:0 0 auto!important}
#ra-app .ra-content{min-height:0!important;overflow:auto!important;flex:1 1 0!important;scrollbar-width:thin;scrollbar-color:var(--ra-accent) var(--ra-panel2)}
#ra-app .ra-content::-webkit-scrollbar{width:11px;height:11px}
#ra-app .ra-content::-webkit-scrollbar-track{background:var(--ra-panel2)}
#ra-app .ra-content::-webkit-scrollbar-thumb{background:var(--ra-accent);border:3px solid var(--ra-panel2);border-radius:99px}
#ra-app.ra-maximized{left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;min-width:0!important;min-height:0!important;border-radius:0!important;resize:none!important}
#ra-app.ra-maximized .ra-titlebar{cursor:default!important}
`;
    document.head.appendChild(style);
  }

  function stripSidebarSettings() {
    document.querySelectorAll('#ra-nav [data-page="settings"]').forEach(node => node.remove());
  }

  function readWindowGeometry(appNode) {
    if (!appNode) return null;
    const rect = appNode.getBoundingClientRect();
    return {x:rect.left, y:rect.top, width:rect.width, height:rect.height};
  }

  function clampWindowGeometry(geometry) {
    const maxWidth = Math.max(0, window.innerWidth - 8);
    const maxHeight = Math.max(0, window.innerHeight - 8);
    const minWidth = Math.min(560, maxWidth);
    const minHeight = Math.min(420, maxHeight);
    const width = Math.max(minWidth, Math.min(Number(geometry?.width) || 900, maxWidth));
    const height = Math.max(minHeight, Math.min(Number(geometry?.height) || 650, maxHeight));
    const maxX = Math.max(4, window.innerWidth - width - 4);
    const maxY = Math.max(4, window.innerHeight - height - 4);
    return {
      x:Math.max(4, Math.min(Number(geometry?.x) || 20, maxX)),
      y:Math.max(4, Math.min(Number(geometry?.y) || 50, maxY)),
      width,
      height
    };
  }

  function applyWindowGeometry(appNode, geometry) {
    if (!appNode || !geometry) return;
    appNode.style.left = `${geometry.x}px`;
    appNode.style.top = `${geometry.y}px`;
    appNode.style.width = `${geometry.width}px`;
    appNode.style.height = `${geometry.height}px`;
  }

  function persistNormalGeometry(appModule, geometry) {
    const db = appModule?._test?.state?.db;
    if (!db || !geometry) return Promise.resolve(false);
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('meta', 'readwrite');
        const store = tx.objectStore('meta');
        const request = store.get('global');
        request.onsuccess = () => {
          const meta = request.result || {key:'global', settings:appModule._test?.state?.settings || {}};
          meta.ui = meta.ui || {};
          meta.ui.windowGeometry = meta.ui.windowGeometry || {};
          meta.ui.windowGeometry.main = {...geometry};
          store.put(meta);
        };
        request.onerror = () => reject(request.error || new Error('Failed to read Recruitment Agency geometry.'));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('Failed to save Recruitment Agency geometry.'));
      } catch (error) {
        reject(error);
      }
    });
  }

  function syncMaximizeButton() {
    const button = document.getElementById('ra-maximize');
    if (!button) return;
    const label = shellUiState.maximized ? 'Restore' : 'Maximize';
    button.textContent = label;
    button.title = label;
    button.setAttribute('aria-label', label);
  }

  async function maximizeApp(appModule) {
    const appNode = document.getElementById('ra-app');
    if (!appNode || shellUiState.maximized) return;
    const geometry = readWindowGeometry(appNode);
    if (!geometry) return;

    const appState = appModule?._test?.state;
    if (appState?.resizeTimer) {
      clearTimeout(appState.resizeTimer);
      appState.resizeTimer = null;
    }

    shellUiState.restoreGeometry = geometry;
    shellUiState.maximized = true;
    appNode.classList.add('ra-maximized');
    syncMaximizeButton();
    try {
      await persistNormalGeometry(appModule, geometry);
    } catch (error) {
      shellUiState.maximized = false;
      appNode.classList.remove('ra-maximized');
      shellUiState.restoreGeometry = null;
      syncMaximizeButton();
      throw error;
    }
  }

  async function restoreApp(appModule) {
    const appNode = document.getElementById('ra-app');
    if (!appNode || !shellUiState.maximized) return;
    const geometry = clampWindowGeometry(shellUiState.restoreGeometry || readWindowGeometry(appNode));

    shellUiState.maximized = false;
    appNode.classList.remove('ra-maximized');
    applyWindowGeometry(appNode, geometry);
    shellUiState.restoreGeometry = null;
    syncMaximizeButton();
    await persistNormalGeometry(appModule, geometry);
  }

  async function toggleMaximize(appModule) {
    if (shellUiState.maximized) await restoreApp(appModule);
    else await maximizeApp(appModule);
  }

  function enhanceShellUi(appModule) {
    const appNode = document.getElementById('ra-app');
    const actions = appNode?.querySelector('.ra-title-actions');
    const settings = document.getElementById('ra-settings-button');
    if (!appNode || !actions || !settings) throw new Error('Recruitment Agency shell controls are unavailable.');

    injectShellStyles();
    stripSidebarSettings();

    const nav = document.getElementById('ra-nav');
    if (nav && !shellUiState.navObserver) {
      shellUiState.navObserver = new MutationObserver(stripSidebarSettings);
      shellUiState.navObserver.observe(nav, {childList:true, subtree:true});
    }

    let maximize = document.getElementById('ra-maximize');
    if (!maximize) {
      maximize = document.createElement('button');
      maximize.type = 'button';
      maximize.className = 'ra-btn';
      maximize.id = 'ra-maximize';
      maximize.textContent = 'Maximize';
      maximize.title = 'Maximize';
      maximize.setAttribute('aria-label', 'Maximize');
      actions.insertBefore(maximize, settings);
    }
    maximize.onclick = () => toggleMaximize(appModule).catch(error => {
      console.error(`[RA] ${INSTALLER_VERSION} maximize/restore failed.`, error);
      try { alert(`Recruitment Agency window control failed: ${error?.message || error}`); } catch {}
    });
    syncMaximizeButton();
  }

  removeLegacyRecruitmentUi();
  const clickBridge = installClickListenerBridge();
  installPrimaryInputShield(clickBridge);
  installMaximizedDragGuard();

  const app = window.RA_V45App;
  if (!app || typeof app.start !== 'function') {
    clearDomGuard();
    const message = `Recruitment Agency ${INSTALLER_VERSION} could not load its application module. Update or reinstall the userscript so Tampermonkey refreshes the pinned runtime files.`;
    console.error('[RA]', message);
    alert(message);
    return;
  }

  if (String(app.SCRIPT_VERSION || '') !== EXPECTED_APP_VERSION) {
    clearDomGuard();
    const message = `Recruitment Agency ${INSTALLER_VERSION} detected a mismatched runtime (${app.SCRIPT_VERSION || 'unknown'}). Update or reinstall the userscript before continuing.`;
    console.error('[RA]', message);
    alert(message);
    return;
  }

  const restoreResizeObserver = installShellResizeGuard();
  app.start().then(() => {
    restoreResizeObserver();
    enhanceShellUi(app);
  }).catch(error => {
    restoreResizeObserver();
    clearDomGuard();
    console.error(`[RA] ${INSTALLER_VERSION} failed to start.`, error);
    alert(`Recruitment Agency could not start: ${error?.message || error}`);
  });
})();