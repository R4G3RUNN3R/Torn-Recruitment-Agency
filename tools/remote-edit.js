'use strict';

const fs = require('node:fs');

function replaceOnce(text, label, before, after) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`Could not find ${label}`);
  if (text.indexOf(before, first + before.length) >= 0) throw new Error(`Found ${label} more than once`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}

const corePath = 'src/match-core.js';
let core = fs.readFileSync(corePath, 'utf8');
core = replaceOnce(core, 'normalizeCandidate function', `  function normalizeCandidate(input) {
    const source = input && typeof input === 'object' ? input : {};
    const manualFields = source.manualFields && typeof source.manualFields === 'object' ? clone(source.manualFields) : {};
    const merged = mergeCandidateValues({
      manual: Object.assign({}, source, manualFields),
      parsed: source.parsed && typeof source.parsed === 'object' ? source.parsed : {}
    });
    return {
      userId: cleanText(source.userId || source.id || source.playerId),
      desiredCompany: merged.desiredCompany,
      desiredRole: merged.desiredRole,
      expectedSalary: merged.expectedSalary,
      availability: merged.availability,
      recruiterNote: merged.recruiterNote,
      manualFields: {
        desiredCompany: hasManualValue(manualFields, 'desiredCompany') || hasManualValue(source, 'desiredCompany'),
        desiredRole: hasManualValue(manualFields, 'desiredRole') || hasManualValue(source, 'desiredRole'),
        expectedSalary: hasManualValue(manualFields, 'expectedSalary') || hasManualValue(source, 'expectedSalary'),
        availability: hasManualValue(manualFields, 'availability') || hasManualValue(source, 'availability')
      },
      createdAt: cleanText(source.createdAt),
      updatedAt: cleanText(source.updatedAt)
    };
  }`, `  function normalizeCandidate(input) {
    const source = input && typeof input === 'object' ? input : {};
    const hasManualObject = !!(source.manualFields && typeof source.manualFields === 'object' && !Array.isArray(source.manualFields));
    const manual = hasManualObject ? clone(source.manualFields) : {
      desiredCompany: source.desiredCompany,
      desiredRole: source.desiredRole,
      expectedSalary: source.expectedSalary,
      availability: source.availability
    };
    const parsed = source.parsed && typeof source.parsed === 'object' ? source.parsed : (hasManualObject ? {
      desiredCompany: source.desiredCompany,
      desiredRole: source.desiredRole,
      expectedSalary: source.expectedSalary,
      availability: source.availability
    } : {});
    const merged = mergeCandidateValues({ manual, parsed });
    return {
      userId: cleanText(source.userId || source.id || source.playerId),
      desiredCompany: merged.desiredCompany,
      desiredRole: merged.desiredRole,
      expectedSalary: merged.expectedSalary,
      availability: merged.availability,
      recruiterNote: cleanText(source.recruiterNote || merged.recruiterNote),
      manualFields: {
        desiredCompany: cleanText(manual.desiredCompany),
        desiredRole: cleanText(manual.desiredRole),
        expectedSalary: finitePositiveOrNull(manual.expectedSalary),
        availability: normalizeAvailability(manual.availability)
      },
      createdAt: cleanText(source.createdAt),
      updatedAt: cleanText(source.updatedAt)
    };
  }`);
fs.writeFileSync(corePath, core);

const userPath = 'R4G3RUNN3R-Recruitment-Agency.user.js';
let s = fs.readFileSync(userPath, 'utf8');
s = replaceOnce(s, 'userscript version metadata', '// @version      4.3.0', '// @version      4.4.0');
s = replaceOnce(s, 'Match Core require insertion', '// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/global-core.js', '// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/global-core.js\n// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/src/match-core.js');
s = replaceOnce(s, 'required core bootstrap', `    const Core = window.RA_ScoutCore;
    const ResultsCore = window.RA_ResultsCore;
    const GlobalCore = window.RA_GlobalCore;
    if (!Core || !ResultsCore || !GlobalCore) {
        console.error("[RA] Required core module did not load.");
        return;
    }

    const SCRIPT_VERSION = "4.3.0";
    const DB_NAME = "tornWorkerDB";
    const REQUIRED_DB_VERSION = 10;`, `    const Core = window.RA_ScoutCore;
    const ResultsCore = window.RA_ResultsCore;
    const GlobalCore = window.RA_GlobalCore;
    const MatchCore = window.RA_MatchCore;
    if (!Core || !ResultsCore || !GlobalCore || !MatchCore) {
        console.error("[RA] Required core module did not load.");
        return;
    }

    const SCRIPT_VERSION = "4.4.0";
    const DB_NAME = "tornWorkerDB";
    const REQUIRED_DB_VERSION = 11;`);
s = replaceOnce(s, 'default Match settings', `        global: {
            enabled: true,
            endpoint: "",
            lookupCacheMs: 30 * 60 * 1000,
            maxRetryAttempts: 5
        },
        scout: DEFAULT_SCOUT`, `        global: {
            enabled: true,
            endpoint: "",
            lookupCacheMs: 30 * 60 * 1000,
            maxRetryAttempts: 5
        },
        match: {
            activeProfileId: ""
        },
        scout: DEFAULT_SCOUT`);
s = replaceOnce(s, 'Match nested settings source', `        const scout = raw.scout || {};
        const global = raw.global || {};`, `        const scout = raw.scout || {};
        const global = raw.global || {};
        const match = raw.match || {};`);
s = replaceOnce(s, 'Match nested settings merge', `            global: {...DEFAULT_SETTINGS.global, ...global},
            scout: {`, `            global: {...DEFAULT_SETTINGS.global, ...global},
            match: {...DEFAULT_SETTINGS.match, ...match},
            scout: {`);
s = replaceOnce(s, 'Match IndexedDB stores', `                if (!d.objectStoreNames.contains("globalSyncQueue")) d.createObjectStore("globalSyncQueue", {keyPath: "queueId"});`, `                if (!d.objectStoreNames.contains("globalSyncQueue")) d.createObjectStore("globalSyncQueue", {keyPath: "queueId"});
                if (!d.objectStoreNames.contains("candidateLocal")) d.createObjectStore("candidateLocal", {keyPath:"userId"});
                if (!d.objectStoreNames.contains("matchProfiles")) d.createObjectStore("matchProfiles", {keyPath:"profileId"});`);
s = replaceOnce(s, 'Smart Match persistence helpers', `    async function saveSync(modeName, patch) {`, `    async function saveMatchProfile(profile) {
        const normalized = MatchCore.normalizeProfile(profile || {});
        const existing = normalized.profileId ? await idb.get("matchProfiles", normalized.profileId) : null;
        const now = new Date().toISOString();
        normalized.createdAt = existing?.createdAt || normalized.createdAt || now;
        normalized.updatedAt = now;
        await idb.put("matchProfiles", normalized);
        return normalized;
    }

    async function deleteMatchProfile(profileId) {
        const id = String(profileId || "").trim();
        return id ? idb.delete("matchProfiles", id) : false;
    }

    async function ensureDefaultMatchProfile() {
        const profiles = await idb.getAll("matchProfiles");
        if (profiles.length) {
            const active = profiles.find(p => p.profileId === settings.match.activeProfileId) || profiles[0];
            if (active.profileId !== settings.match.activeProfileId) {
                await saveMetaSettings({match:{...settings.match,activeProfileId:active.profileId}});
            }
            return MatchCore.normalizeProfile(active);
        }
        const profile = await saveMatchProfile(MatchCore.createDefaultProfile("Default Recruit"));
        await saveMetaSettings({match:{...settings.match,activeProfileId:profile.profileId}});
        return profile;
    }

    async function getActiveMatchProfile() {
        const id = String(settings?.match?.activeProfileId || "").trim();
        if (id) {
            const profile = await idb.get("matchProfiles", id);
            if (profile) return MatchCore.normalizeProfile(profile);
        }
        return ensureDefaultMatchProfile();
    }

    async function getCandidateLocal(userId) {
        const id = String(userId || "").trim();
        if (!id) return null;
        const record = await idb.get("candidateLocal", id);
        return record ? MatchCore.normalizeCandidate(record) : null;
    }

    async function saveCandidateLocal(userId, patch = {}) {
        const id = String(userId || "").trim();
        if (!id) throw new Error("Candidate userId is required.");
        const existing = await getCandidateLocal(id);
        const manualFields = {...(existing?.manualFields || {})};
        for (const key of ["desiredCompany","desiredRole","expectedSalary","availability"]) {
            if (Object.prototype.hasOwnProperty.call(patch, key)) manualFields[key] = patch[key];
        }
        const now = new Date().toISOString();
        const record = MatchCore.normalizeCandidate({
            ...(existing || {}),
            ...patch,
            userId:id,
            manualFields,
            createdAt:existing?.createdAt || now,
            updatedAt:now
        });
        await idb.put("candidateLocal", record);
        return record;
    }

    function buildMatchInputRow(row) {
        const scout = row?.scout || (row?.profile ? row : null);
        const w = scout?.w30 || scout?.provisionalSource || {};
        const fit = snapshotFit(scout);
        return {
            ...row,
            fit,
            matchInputs: {
                fit,
                activity30:w.activityHours ?? null,
                xanax30:w.xanax ?? null,
                refills30:w.refills ?? null,
                attacks30:w.attacks ?? null,
                rwHits30:w.rwHits ?? null
            }
        };
    }

    async function evaluateRowMatch(row, profile = null, candidate = undefined) {
        const activeProfile = profile || await getActiveMatchProfile();
        const local = candidate === undefined ? await getCandidateLocal(row?.userId || row?.id) : candidate;
        return MatchCore.evaluateMatch({row:buildMatchInputRow(row),candidate:local || {},profile:activeProfile});
    }

    async function refreshMatchScores() {
        const profile = await getActiveMatchProfile();
        await Promise.all(resultRows.map(async row => {
            const candidate = await getCandidateLocal(row?.userId || row?.id);
            const result = MatchCore.evaluateMatch({row:buildMatchInputRow(row),candidate:candidate || {},profile});
            row.candidateLocal = candidate;
            row.matchResult = result;
            row.matchScore = result.score;
        }));
    }

    async function saveSync(modeName, patch) {`);
s = replaceOnce(s, 'refreshResults Match enrichment', `            resultRows = users.map(u => ({...u,scout:latest.get(Number(u.userId)) || null}));
        }
        renderResults();`, `            resultRows = users.map(u => ({...u,scout:latest.get(Number(u.userId)) || null}));
        }
        try { await refreshMatchScores(); }
        catch (e) { console.warn("[RA] Smart Match enrichment failed.", e); }
        renderResults();`);
fs.writeFileSync(userPath, s);
