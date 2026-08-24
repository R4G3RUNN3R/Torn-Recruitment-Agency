const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');
const APP=path.join(ROOT,'src','v45-app.js');

function replaceOnce(text,oldText,newText,label){
  const at=text.indexOf(oldText);
  if(at<0)throw new Error(`Missing expected source for ${label}`);
  if(text.indexOf(oldText,at+oldText.length)>=0)throw new Error(`Expected unique source for ${label}`);
  return text.slice(0,at)+newText+text.slice(at+oldText.length);
}

let app=fs.readFileSync(APP,'utf8');

app=replaceOnce(app,
`  async function deleteCandidate(id){if(!confirm('Delete this local candidate and their local forum source records?'))return;await idb.delete('candidateLocal',String(id));await idb.delete('candidateLocal',Number(id));for(const source of await idb.getAll('forumSources'))if(String(source.userId)===String(id))await idb.delete('forumSources',source.sourceId);toast('Local candidate deleted.');await route(state.page,false);}\n`,
`  async function deleteCompanyCandidateData(id){const userId=V46Domain.normalizeUserId(id);await idb.delete('candidateLocal',userId);await idb.delete('candidateLocal',Number(userId));await idb.delete('companyRecruitment',userId);for(const row of await idb.getAll('users'))if(text(row.userId)===userId&&text(row.sourceMode).toLowerCase()!=='faction')await idb.delete('users',row.recordId);for(const source of await idb.getAll('forumSources'))if(text(source.userId)===userId&&text(source.sourceType).toUpperCase()!=='FACTION FORUM')await idb.delete('forumSources',source.sourceId);return true;}\n  async function deleteCandidate(id){if(!confirm('Delete this local Company candidate and their Company recruitment source records?'))return;await deleteCompanyCandidateData(id);toast('Local Company candidate deleted.');await route(state.page,false);}\n`,
'domain-safe Company candidate delete');

app=replaceOnce(app,
`  async function clearRecruitment(){if(!confirm('Clear local candidate and forum discovery data?'))return;for(const store of ['users','candidateLocal','forumSources','forumSyncState'])await idb.clear(store);toast('Candidate/forum data cleared.');await logEvent('reset','Candidate and forum data cleared');await route(state.page,false);}\n`,
`  async function clearRecruitmentData(){for(const store of ['users','candidateLocal','companyRecruitment','factionRecruitment','forumSources','forumSyncState'])await idb.clear(store);return true;}\n  async function clearRecruitment(){if(!confirm('Clear local Company/Faction recruitment and forum discovery data? Shared Scout/Player Intelligence will be kept.'))return;await clearRecruitmentData();toast('Recruitment/forum data cleared.');await logEvent('reset','Recruitment and forum data cleared');await route(state.page,false);}\n`,
'domain-aware recruitment clear');

app=replaceOnce(app,
`_test:{state,repositories,recruitmentDomainForFeed,persistDiscoveredCandidate,applyCandidateFilters,candidateCsvRow,matchAvailability,forumThreadUrl}});`,
`_test:{state,repositories,recruitmentDomainForFeed,persistDiscoveredCandidate,deleteCompanyCandidateData,clearRecruitmentData,applyCandidateFilters,candidateCsvRow,matchAvailability,forumThreadUrl}});`,
'cleanup test exports');

fs.writeFileSync(APP,app);
console.log('Applied guarded v4.6 domain cleanup patch.');
