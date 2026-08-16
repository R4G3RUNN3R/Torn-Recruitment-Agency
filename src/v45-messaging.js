(function (root, factory) {
  let forum = root && root.RA_ForumCore;
  if (!forum && typeof module === 'object' && module.exports) forum = require('./forum-core');
  const api = factory(forum);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RA_V45Messaging = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ForumCore) {
  'use strict';
  if (!ForumCore) throw new Error('RA_ForumCore is required.');

  const PLACEHOLDERS = Object.freeze(['name','player_id','looking_for','company_name','current_company','match_score','fit_score']);

  function text(value) { return String(value ?? '').trim(); }

  function approvedValues(input = {}) {
    return Object.fromEntries(PLACEHOLDERS.map(key => [key, text(input[key])]));
  }

  function cleanPreparedText(value) {
    return String(value || '')
      .replace(/\s+([,.;!?])/g,'$1')
      .replace(/:\s*([,.;!?])/g,'$1')
      .replace(/\(\s*\)/g,'')
      .replace(/\[\s*\]/g,'')
      .replace(/[ \t]{2,}/g,' ')
      .replace(/\n[ \t]+/g,'\n')
      .replace(/\n{3,}/g,'\n\n')
      .trim();
  }

  function prepareMessage(template, input = {}) {
    const values = approvedValues(input);
    const prepared = ForumCore.substituteMessage(String(template || ''), values);
    return cleanPreparedText(prepared);
  }

  function composeUrl(userId) {
    const id = text(userId);
    return /^\d+$/.test(id) ? `https://www.torn.com/messages.php#/p=compose&XID=${id}` : '';
  }

  function messagePlan(template, input = {}) {
    const userId = text(input.player_id || input.userId);
    if (!/^\d+$/.test(userId)) throw new Error('A valid Torn player ID is required.');
    return {
      userId,
      preparedText:prepareMessage(template,{...input,player_id:userId}),
      composeUrl:composeUrl(userId),
      autoSubmit:false,
      stageChange:null
    };
  }

  return Object.freeze({PLACEHOLDERS,approvedValues,cleanPreparedText,prepareMessage,composeUrl,messagePlan});
});
