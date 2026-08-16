(function (root, factory) {
  let forum = root && root.RA_ForumCore;
  if (!forum && typeof module === 'object' && module.exports) forum = require('./forum-core');
  const api = factory(forum);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RA_V45Discovery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ForumCore) {
  'use strict';
  if (!ForumCore) throw new Error('RA_ForumCore is required.');

  const SOURCE_TYPES = Object.freeze({
    company:'COMPANY FORUM',
    faction:'FACTION FORUM',
    training:'TRAIN BUYER',
    manual:'MANUAL'
  });

  function text(value) { return String(value ?? '').trim(); }
  function finite(value) { const out=Number(value); return Number.isFinite(out) ? out : null; }

  function feedDefinitions(recruitment = {}) {
    return [
      {feedId:'company',label:'Company Forum',sourceType:SOURCE_TYPES.company,threadId:text(recruitment.companyThreadId),enabled:!!text(recruitment.companyThreadId)},
      {feedId:'faction',label:'Faction Forum',sourceType:SOURCE_TYPES.faction,threadId:text(recruitment.factionThreadId),enabled:!!text(recruitment.factionThreadId)},
      {feedId:'training',label:'Train Buyers',sourceType:SOURCE_TYPES.training,threadId:text(recruitment.trainingThreadId),enabled:!!text(recruitment.trainingThreadId)}
    ];
  }

  function stripHtml(value) {
    return text(value).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  }

  function postToSource(post = {}, feed = {}, observedAt = Date.now()) {
    const userId = finite(post.author?.id ?? post.user_id ?? post.userId);
    if (!userId) return null;
    const body = stripHtml(post.content ?? post.body ?? post.text);
    if (!body) return null;
    const postedRaw = finite(post.created_time ?? post.created_at ?? post.postedAt);
    const postedAt = postedRaw === null ? Number(observedAt) : (postedRaw < 1e12 ? postedRaw * 1000 : postedRaw);
    const source = ForumCore.normalizeSource({
      sourceType:feed.sourceType,
      threadId:feed.threadId,
      postId:post.id ?? post.post_id,
      userId,
      postedAt,
      observedAt,
      authorName:text(post.author?.username ?? post.author?.name ?? post.name),
      body,
      parsed:ForumCore.parseForumIntent(body),
      url:text(post.url || feed.url)
    });
    source.body = body;
    source.authorName = text(post.author?.username ?? post.author?.name ?? post.name);
    return source;
  }

  function initialCounters(previous = {}) {
    return {
      pagesChecked:Number(previous.pagesChecked || 0),
      postsExamined:Number(previous.postsExamined || 0),
      recentPosts:Number(previous.recentPosts || 0),
      candidatesCreated:Number(previous.candidatesCreated || 0),
      candidatesUpdated:Number(previous.candidatesUpdated || 0),
      explicitTrainBuyers:Number(previous.explicitTrainBuyers || 0),
      companyLookups:Number(previous.companyLookups || 0)
    };
  }

  async function processDiscoveryPage(options = {}) {
    const feed = options.feed || {};
    const posts = Array.isArray(options.posts) ? options.posts : [];
    const persistSource = options.persistSource;
    const getCandidate = options.getCandidate;
    const persistCandidate = options.persistCandidate;
    const persistCounters = options.persistCounters;
    const persistCheckpoint = options.persistCheckpoint;
    if (![persistSource,getCandidate,persistCandidate,persistCounters,persistCheckpoint].every(fn => typeof fn === 'function')) throw new Error('Discovery persistence callbacks are required.');

    const counters = initialCounters(options.counters);
    counters.pagesChecked += 1;
    const recentCutoff = Number(options.recentCutoff || 0);

    for (const post of posts) {
      counters.postsExamined += 1;
      const source = postToSource(post,feed,options.observedAt || Date.now());
      if (!source) continue;
      if (!recentCutoff || Number(source.postedAt || 0) >= recentCutoff) counters.recentPosts += 1;
      await persistSource(source);
      const existing = await getCandidate(source.userId);
      const merged = ForumCore.mergeCandidateFromSource(existing || {userId:source.userId,pipelineStage:'Not Contacted'}, source);
      merged.name = text(existing?.name || source.authorName || merged.name);
      merged.latestForumSourceId = source.sourceId;
      merged.updatedAt = new Date(options.observedAt || Date.now()).toISOString();
      await persistCandidate(merged);
      if (existing) counters.candidatesUpdated += 1;
      else counters.candidatesCreated += 1;
      if (source.parsed?.wantsTrains) counters.explicitTrainBuyers += 1;
    }

    await persistCounters({...counters});
    const safeContinuation = ForumCore.sanitizeContinuation(options.continuation || '');
    await persistCheckpoint({
      feedId:text(feed.feedId),
      next:safeContinuation,
      updatedAt:Number(options.observedAt || Date.now()),
      resumeAvailable:!!safeContinuation,
      counters:{...counters}
    });
    return {counters,safeContinuation};
  }

  function addCandidateRecord(input = {}, existing = null, now = Date.now()) {
    const userId = text(input.userId || input.id);
    if (!/^\d+$/.test(userId)) throw new Error('A valid Torn player ID is required.');
    const base = existing || {userId,pipelineStage:'Not Contacted',discoverySources:[]};
    const manualFields = {...(base.manualFields || {})};
    for (const key of ['desiredCompany','desiredRole','expectedSalary','availability']) {
      if (Object.prototype.hasOwnProperty.call(input,key)) manualFields[key]=input[key];
    }
    return {
      ...base,
      ...input,
      userId,
      pipelineStage:ForumCore.normalizeStage(base.pipelineStage || input.pipelineStage),
      availability:Object.prototype.hasOwnProperty.call(input,'availability') ? ForumCore.normalizeAvailability(input.availability) : ForumCore.normalizeAvailability(base.availability),
      manualFields,
      discoverySources:[...new Set([...(base.discoverySources || []),SOURCE_TYPES.manual])],
      createdAt:base.createdAt || new Date(now).toISOString(),
      updatedAt:new Date(now).toISOString()
    };
  }

  function fillCompaniesPlan(candidates = []) {
    return (candidates || []).filter(candidate => !text(candidate.currentCompany)).map(candidate => ({
      userId:Number(candidate.userId),
      status:'pending',
      error:''
    })).filter(item => Number.isFinite(item.userId) && item.userId > 0);
  }

  return Object.freeze({
    SOURCE_TYPES,
    feedDefinitions,
    stripHtml,
    postToSource,
    initialCounters,
    processDiscoveryPage,
    addCandidateRecord,
    fillCompaniesPlan
  });
});
