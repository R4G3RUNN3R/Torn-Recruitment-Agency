const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'..','README.md');
let src=fs.readFileSync(file,'utf8');
function replaceOnce(search,replacement,label){if(!src.includes(search))throw new Error(`README patch guard failed: ${label}`);src=src.replace(search,replacement);}
replaceOnce(
"## v4.6 development foundation\n\nThe repository now contains an internal **v4.6 Foundation** behind the still-public v4.5.4 installer. This is infrastructure for the approved Company/Faction recruitment architecture, not a claim that the later v4.6 user-facing workflow tabs have shipped.",
"## v4.6 source development\n\nThe repository now contains the internal **v4.6 Foundation plus the complete source-level Company Recruitment slice** behind the still-public v4.5.4 installer. Company Recruitment is implemented and verified in source, while the public installer remains intentionally release-isolated until the separate v4.6 pin/version hardening step is complete.",
'heading and status'
);
replaceOnce(
"- Source-level IndexedDB moves additively to **DB13** and adds `playerIntelligence`, `companyRecruitment`, and `factionRecruitment` without deleting the DB12 stores.",
"- Source-level IndexedDB upgrades additively through **DB14**. DB13 adds `playerIntelligence`, `companyRecruitment`, and `factionRecruitment`; DB14 adds `companyVacancies`, `companyCampaigns`, `companyRecruitmentConfig`, and `companyRecruitmentSessions`. No prior object store is deleted.",
'DB14 documentation'
);
replaceOnce(
"- Dedicated Company/Faction pages plus Vacancies, Requirements, Today, Follow-ups, Workforce, Analytics, and the other approved v4.6 workflow slices remain follow-on deliveries.",
"- The Company slice now provides dedicated Overview, Today, Discover, Candidates, Pipeline, Vacancies, Campaigns, Follow-ups, Timeline, Stage Aging, Contact Outcomes, Recruitment Sessions, Talent Pool, Reactivation, Opportunity Queue, and Compare routes. Baseline Hard/Preferred requirements, per-requirement waivers, vacancy matching/pinning, DNC, explicit session advancement, cycle-preserving reactivation, and explainable Opportunity scoring remain Company-only. Faction workflow state is not read or mutated by these Company operations.",
'Company capability documentation'
);
fs.writeFileSync(file,src);
console.log('Updated README with source-level v4.6 Company Recruitment and DB14 status.');
