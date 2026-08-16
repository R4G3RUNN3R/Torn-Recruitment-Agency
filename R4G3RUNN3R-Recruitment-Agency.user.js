// ==UserScript==
// @name         R4G3RUNN3R's Recruitment Agency
// @namespace    r4g3runn3r.recruitment.agency
// @version      4.5.0
// @description  Recruitment discovery, candidate pipeline, Scout intelligence and local recruitment workflow for Torn.
// @author       R4G3RUNN3R[3877028]
// @license      MIT
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/scout-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/results-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/global-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/match-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/forum-core.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/v45-runtime.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/v45-candidates.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/v45-discovery.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/v45-messaging.js
// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/v45-app.js
// @downloadURL  https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/R4G3RUNN3R-Recruitment-Agency.user.js
// @updateURL    https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/R4G3RUNN3R-Recruitment-Agency.user.js
// ==/UserScript==

(() => {
  'use strict';
  if (window.__R4G3_RECRUITMENT_AGENCY_V45__) return;
  window.__R4G3_RECRUITMENT_AGENCY_V45__ = true;
  const app = window.RA_V45App;
  if (!app || typeof app.start !== 'function') {
    console.error('[RA] v4.5 application module did not load.');
    return;
  }
  app.start().catch(error => {
    console.error('[RA] v4.5 failed to start.', error);
    alert(`Recruitment Agency could not start: ${error?.message || error}`);
  });
})();
