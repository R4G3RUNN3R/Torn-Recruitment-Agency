const fs=require('node:fs');
const path=require('node:path');

function patch(file,search,replacement,label){
  const full=path.join(__dirname,'..',file);
  let src=fs.readFileSync(full,'utf8');
  if(!src.includes(search))throw new Error(`Patch guard failed: ${label}`);
  src=src.replace(search,replacement);
  fs.writeFileSync(full,src);
}

patch(
  'src/v46-company-platform.js',
  "  function bindNav(){if(!runtime.app)return;document.querySelectorAll('#ra-nav [data-page]').forEach(button=>{const page=text(button.dataset.page);if(!IMPLEMENTED_ROUTES.has(page))return;if(!runtime.originalHandlers.has(button))runtime.originalHandlers.set(button,button.onclick||null);button.onclick=event=>{event?.preventDefault?.();renderPage(page).catch(reportError);};});}\n  function install(app,options={})",
  "  function bindNav(){if(!runtime.app)return;document.querySelectorAll('#ra-nav [data-page]').forEach(button=>{const page=text(button.dataset.page);if(!IMPLEMENTED_ROUTES.has(page))return;if(!runtime.originalHandlers.has(button))runtime.originalHandlers.set(button,button.onclick||null);button.onclick=event=>{event?.preventDefault?.();renderPage(page).catch(reportError);};});}\n  function syncNavigation(){bindNav();return true;}\n  function install(app,options={})",
  'platform syncNavigation function'
);

patch(
  'src/v46-company-platform.js',
  "  return Object.freeze({COMPANY_ROUTES,isCompanyRoute,routeMeta,install,uninstall,renderPage,_test:{buildRows,buildOpportunityRows,persistRoute,dbGetAll,dbGet,dbPut,dbDelete,evaluateCandidateVacancies,canMoveToStage,readCriteria,getCampaigns,getSessions,opportunityWeights,IMPLEMENTED_ROUTES}});",
  "  return Object.freeze({COMPANY_ROUTES,isCompanyRoute,routeMeta,install,uninstall,renderPage,syncNavigation,_test:{buildRows,buildOpportunityRows,persistRoute,dbGetAll,dbGet,dbPut,dbDelete,evaluateCandidateVacancies,canMoveToStage,readCriteria,getCampaigns,getSessions,opportunityWeights,IMPLEMENTED_ROUTES}});",
  'platform export syncNavigation'
);

patch(
  'src/v45-app.js',
  "  function rebuildNav(){const target=document.getElementById('ra-nav');if(target)target.innerHTML=navHtml();document.querySelector('.ra-shell')?.classList.toggle('is-collapsed',!!state.settings.sidebarCollapsed);document.querySelectorAll('[data-nav-toggle]').forEach(button=>button.onclick=async()=>{const expanded=V46Navigation.toggleExpandedGroup(state.settings.navigation.expandedGroups,button.dataset.navToggle);await saveSettings({navigation:{...state.settings.navigation,expandedGroups:expanded}});rebuildNav();});document.querySelectorAll('[data-page]').forEach(btn=>btn.onclick=()=>route(btn.dataset.page).catch(e=>toast(e.message,true)));document.querySelector(`[data-page=\"${state.page}\"]`)?.classList.add('active');}",
  "  function rebuildNav(){const target=document.getElementById('ra-nav');if(target)target.innerHTML=navHtml();document.querySelector('.ra-shell')?.classList.toggle('is-collapsed',!!state.settings.sidebarCollapsed);document.querySelectorAll('[data-nav-toggle]').forEach(button=>button.onclick=async()=>{const expanded=V46Navigation.toggleExpandedGroup(state.settings.navigation.expandedGroups,button.dataset.navToggle);await saveSettings({navigation:{...state.settings.navigation,expandedGroups:expanded}});rebuildNav();});document.querySelectorAll('[data-page]').forEach(btn=>btn.onclick=()=>route(btn.dataset.page).catch(e=>toast(e.message,true)));V46CompanyPlatform.syncNavigation?.();document.querySelector(`[data-page=\"${state.page}\"]`)?.classList.add('active');}",
  'base rebuildNav synchronous Company rebind'
);

console.log('Patched synchronous v4.6 Company navigation rebind.');
// trigger marker only; no functional effect
