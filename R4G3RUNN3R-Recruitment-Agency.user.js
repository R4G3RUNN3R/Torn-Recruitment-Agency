// ==UserScript==
// @name         R4G3RUNN3R's Recruitment Agency
// @namespace    r4g3runn3r.recruitment.agency
// @version      4.5.3
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
  const INSTALLER_VERSION = '4.5.3';
  const EXPECTED_APP_VERSION = '4.5.0';
  const DOM_GUARD = 'data-r4g3-ra-v45-owner';
  const RA_ROOT_SELECTOR = '#ra-app,#ra-hover,#ra-context,#ra-help-popover';

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

  removeLegacyRecruitmentUi();
  const clickBridge = installClickListenerBridge();
  installPrimaryInputShield(clickBridge);

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

  app.start().catch(error => {
    clearDomGuard();
    console.error(`[RA] ${INSTALLER_VERSION} failed to start.`, error);
    alert(`Recruitment Agency could not start: ${error?.message || error}`);
  });
})();
