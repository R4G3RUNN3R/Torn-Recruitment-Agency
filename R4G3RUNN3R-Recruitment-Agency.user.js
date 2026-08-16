// ==UserScript==
// @name         R4G3RUNN3R's Recruitment Agency
// @namespace    r4g3runn3r.recruitment.agency
// @version      4.5.1
// @description  Recruitment discovery, candidate pipeline, Scout intelligence and local recruitment workflow for Torn.
// @author       R4G3RUNN3R[3877028]
// @license      MIT
// @match        https://www.torn.com/*
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
  const INSTALLER_VERSION = '4.5.1';
  const EXPECTED_APP_VERSION = '4.5.0';

  if (window.__R4G3_RECRUITMENT_AGENCY_V45__) return;
  window.__R4G3_RECRUITMENT_AGENCY_V45__ = true;

  const app = window.RA_V45App;
  if (!app || typeof app.start !== 'function') {
    const message = `Recruitment Agency ${INSTALLER_VERSION} could not load its application module. Update or reinstall the userscript so Tampermonkey refreshes the pinned runtime files.`;
    console.error('[RA]', message);
    alert(message);
    return;
  }

  if (String(app.SCRIPT_VERSION || '') !== EXPECTED_APP_VERSION) {
    const message = `Recruitment Agency ${INSTALLER_VERSION} detected a mismatched runtime (${app.SCRIPT_VERSION || 'unknown'}). Update or reinstall the userscript before continuing.`;
    console.error('[RA]', message);
    alert(message);
    return;
  }

  app.start().catch(error => {
    console.error(`[RA] ${INSTALLER_VERSION} failed to start.`, error);
    alert(`Recruitment Agency could not start: ${error?.message || error}`);
  });
})();
