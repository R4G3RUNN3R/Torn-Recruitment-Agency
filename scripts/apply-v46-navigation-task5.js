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
`    launcherEnabled:true, includeInactive:false, activePage:'overview', apiKey:'', ownCompanyName:'',\n`,
`    launcherEnabled:true, includeInactive:false, activePage:'overview', navigation:{expandedGroups:['recruitment']}, apiKey:'', ownCompanyName:'',\n`,
'default navigation state');

app=replaceOnce(app,
`    const scout=raw.scout||{};\n    const candidateSettings=raw.candidates||{};\n`,
`    const scout=raw.scout||{};\n    const candidateSettings=raw.candidates||{};\n    const navigationSettings=raw.navigation||{};\n`,
'navigation settings merge input');

app=replaceOnce(app,
`      complexity:raw.complexity==='advanced'?'advanced':'simple',\n      recruitment:Runtime.normalizeRecruitmentSettings({...base.recruitment,...(raw.recruitment||{})}),\n`,
`      complexity:raw.complexity==='advanced'?'advanced':'simple',\n      navigation:{...base.navigation,...navigationSettings,expandedGroups:V46Navigation.normalizeExpandedGroups(Object.hasOwn(navigationSettings,'expandedGroups')?navigationSettings.expandedGroups:base.navigation.expandedGroups)},\n      recruitment:Runtime.normalizeRecruitmentSettings({...base.recruitment,...(raw.recruitment||{})}),\n`,
'navigation settings normalization');

app=replaceOnce(app,
`.ra-sidebar{background:var(--ra-panel);border-right:1px solid var(--ra-line);overflow:auto;padding:8px}.ra-sidebar-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.ra-brand{font-weight:900}.is-collapsed .ra-brand,.is-collapsed .ra-group-label,.is-collapsed .ra-nav-text{display:none}.ra-group-label{font-size:9px;font-weight:900;letter-spacing:.08em;color:var(--ra-muted);margin:12px 8px 4px}.ra-nav{display:grid;gap:3px}.ra-nav button{display:flex;align-items:center;gap:8px;border:0;border-radius:7px;padding:8px;background:transparent;color:var(--ra-text);cursor:pointer;text-align:left}.ra-nav button:hover,.ra-nav button.active{background:var(--ra-panel2)}.ra-nav button.active{box-shadow:inset 3px 0 0 var(--ra-accent)}.ra-nav-icon{width:18px;color:var(--ra-accent2);font-weight:900;text-align:center}\n`,
`.ra-sidebar{background:var(--ra-panel);border-right:1px solid var(--ra-line);overflow:auto;padding:8px}.ra-sidebar-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.ra-brand{font-weight:900}.is-collapsed .ra-brand,.is-collapsed .ra-group-label,.is-collapsed .ra-nav-text{display:none}.ra-group-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:6px;border:0;border-radius:6px;padding:7px 8px;background:transparent;color:var(--ra-muted);cursor:pointer;text-align:left}.ra-group-toggle:hover,.ra-group-toggle:focus-visible{background:var(--ra-panel2);outline:none}.ra-group-toggle.has-active{color:var(--ra-accent2)}.ra-group-label{font-size:9px;font-weight:900;letter-spacing:.08em;color:inherit;margin:0}.ra-group-chevron{font-size:11px;font-weight:900;line-height:1}.ra-nav{display:grid;gap:3px}.ra-nav[hidden]{display:none}.ra-nav button{display:flex;align-items:center;gap:8px;border:0;border-radius:7px;padding:8px;background:transparent;color:var(--ra-text);cursor:pointer;text-align:left}.ra-nav button:hover,.ra-nav button.active{background:var(--ra-panel2)}.ra-nav button.active{box-shadow:inset 3px 0 0 var(--ra-accent)}.ra-nav-icon{width:18px;color:var(--ra-accent2);font-weight:900;text-align:center}\n`,
'collapsible sidebar styles');

app=replaceOnce(app,
`  function navHtml(){return Runtime.visiblePages(state.settings.complexity).map(group=>\`<div><div class="ra-group-label">\${esc(group.label)}</div><div class="ra-nav">\${group.pages.map(page=>\`<button type="button" data-page="\${esc(page.id)}"><span class="ra-nav-icon">\${esc(icon(page.id))}</span><span class="ra-nav-text">\${esc(page.label)}</span></button>\`).join('')}</div></div>\`).join('');}\n  function rebuildNav(){const target=document.getElementById('ra-nav');if(target)target.innerHTML=navHtml();document.querySelector('.ra-shell')?.classList.toggle('is-collapsed',!!state.settings.sidebarCollapsed);document.querySelectorAll('[data-page]').forEach(btn=>btn.onclick=()=>route(btn.dataset.page).catch(e=>toast(e.message,true)));document.querySelector(\`[data-page="\${state.page}"]\`)?.classList.add('active');}\n`,
`  function navHtml(){const expanded=new Set(state.settings.navigation?.expandedGroups||[]);return V46Navigation.visibleGroups(state.settings).map(group=>{const open=expanded.has(group.id);const hasActive=group.pages.some(page=>page.id===state.page);return \`<div class="ra-nav-section"><button type="button" class="ra-group-toggle\${hasActive?' has-active':''}" data-nav-toggle="\${esc(group.id)}" aria-expanded="\${open?'true':'false'}"><span class="ra-group-label">\${esc(group.label)}</span><span class="ra-group-chevron" aria-hidden="true">\${open?'▾':'▸'}</span></button><div class="ra-nav" data-nav-group="\${esc(group.id)}" \${open?'':'hidden'}>\${group.pages.map(page=>\`<button type="button" data-page="\${esc(page.id)}"><span class="ra-nav-icon">\${esc(icon(page.id))}</span><span class="ra-nav-text">\${esc(page.label)}</span></button>\`).join('')}</div></div>\`;}).join('');}\n  function rebuildNav(){const target=document.getElementById('ra-nav');if(target)target.innerHTML=navHtml();document.querySelector('.ra-shell')?.classList.toggle('is-collapsed',!!state.settings.sidebarCollapsed);document.querySelectorAll('[data-nav-toggle]').forEach(button=>button.onclick=async()=>{const expanded=V46Navigation.toggleExpandedGroup(state.settings.navigation.expandedGroups,button.dataset.navToggle);await saveSettings({navigation:{...state.settings.navigation,expandedGroups:expanded}});rebuildNav();});document.querySelectorAll('[data-page]').forEach(btn=>btn.onclick=()=>route(btn.dataset.page).catch(e=>toast(e.message,true)));document.querySelector(\`[data-page="\${state.page}"]\`)?.classList.add('active');}\n`,
'navigation rendering and bindings');

app=replaceOnce(app,
`  async function route(page,persist=true){state.page=Runtime.normalizePage(page,state.settings.complexity);`,
`  async function route(page,persist=true){state.page=V46Navigation.normalizeRoute(page,state.settings.complexity);`,
'route normalization');

app=replaceOnce(app,
`state.settings=mergeSettings((await getMeta()).settings||{});state.page=Runtime.normalizePage(state.settings.activePage,state.settings.complexity);`,
`state.settings=mergeSettings((await getMeta()).settings||{});state.page=V46Navigation.normalizeRoute(state.settings.activePage,state.settings.complexity);`,
'start route restoration');

fs.writeFileSync(APP,app);
console.log('Applied guarded v4.6 navigation integration patch.');
