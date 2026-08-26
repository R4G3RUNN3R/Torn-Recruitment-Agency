const fs=require('fs');

function replaceOnce(path,before,after){
  const source=fs.readFileSync(path,'utf8');
  const parts=source.split(before);
  if(parts.length!==2)throw new Error(`${path}: expected exactly one anchor, found ${parts.length-1}`);
  fs.writeFileSync(path,parts[0]+after+parts[1]);
}

const uiPath='src/v47-faction-ui.js';
const platformPath='src/v47-faction-platform.js';

const waiverUiHelper=`
  function renderWaiverManagement({baseline={},profiles=[],rows=[]}={}){
    const normalizedBaseline=FactionCore.normalizeBaseline(baseline||{});
    const normalizedProfiles=(Array.isArray(profiles)?profiles:[]).map(FactionCore.normalizeSpecialistProfile);
    const candidateRows=Array.isArray(rows)?rows:[];
    const playerOptions=candidateRows.map(row=>'<option value="'+esc(row.userId)+'">'+esc(row.name||('User '+row.userId))+' · '+esc(row.userId)+' · '+esc(row.baselineEligibility||'Unknown')+'</option>').join('');
    const profileOptions=normalizedProfiles.map(profile=>'<option value="'+esc(profile.profileId)+'">'+esc(profile.name||profile.profileId)+'</option>').join('');
    const requirementOptions=[
      ...normalizedBaseline.criteria.map(req=>'<option value="'+esc(req.id)+'" data-waiver-context="baseline" data-waiver-profile="">Baseline · '+esc(req.label||req.id)+'</option>'),
      ...normalizedProfiles.flatMap(profile=>(profile.criteria||[]).map(req=>'<option value="'+esc(req.id)+'" data-waiver-context="specialist" data-waiver-profile="'+esc(profile.profileId)+'">Specialist · '+esc(profile.name||profile.profileId)+' · '+esc(req.label||req.id)+'</option>'))
    ].join('');
    const candidateStatus=candidateRows.map(row=>'<tr><td>'+esc(row.name||('User '+row.userId))+' <small class="ra-muted">'+esc(row.userId)+'</small></td><td>'+esc(row.baselineEligibility||'Unknown')+'</td><td>'+number((row.waivers||[]).filter(item=>text(item.state)==='Active').length)+'</td></tr>').join('');
    const history=candidateRows.flatMap(row=>(Array.isArray(row.waivers)?row.waivers:[]).map(waiver=>({row,waiver}))).sort((a,b)=>number(b.waiver.grantedAt)-number(a.waiver.grantedAt)).map(({row,waiver})=>{
      const context=text(waiver.context).toLowerCase()==='specialist'?'specialist':'baseline';
      const profile=context==='specialist'?normalizedProfiles.find(item=>text(item.profileId)===text(waiver.profileId)):null;
      const criteria=context==='specialist'?(profile?.criteria||[]):normalizedBaseline.criteria;
      const requirement=criteria.find(item=>text(item.id)===text(waiver.requirementId));
      const requirementLabel=text(requirement?.label)||text(waiver.requirementId)||'Unknown requirement';
      const contextLabel=context==='specialist'?('Specialist · '+(profile?.name||waiver.profileId||'Unknown profile')):'Baseline';
      const active=text(waiver.state)==='Active';
      const resolveButton=active?'<button type="button" class="ra-btn" data-faction-waiver-resolve="'+esc(waiver.waiverId)+'" data-faction-waiver-player="'+esc(row.userId)+'">Resolve</button>':'';
      return '<tr><td>'+esc(row.name||('User '+row.userId))+'</td><td>'+esc(requirementLabel)+'</td><td>'+esc(contextLabel)+'</td><td>'+esc(waiver.reason)+'</td><td>'+esc(waiver.state||'Unknown')+'</td><td>'+esc(dateText(waiver.reviewAt))+'</td><td>'+esc(waiver.resolvedReason||'')+'</td><td>'+resolveButton+'</td></tr>';
    }).join('');
    return '<section class="ra-panel"><div class="ra-panel-head"><div><h3>Waiver Management</h3><p>Grant an individual exception without changing the underlying Player Intelligence fact or requirement. Resolved waivers remain in history.</p></div></div>'+
      '<div class="ra-formgrid"><div class="ra-field"><label>Candidate</label><select id="ra-faction-waiver-player"><option value="">Choose candidate</option>'+playerOptions+'</select></div>'+
      '<div class="ra-field"><label>Context</label><select id="ra-faction-waiver-context"><option value="baseline">Baseline</option><option value="specialist">Specialist</option></select></div>'+
      '<div class="ra-field"><label>Specialist Profile</label><select id="ra-faction-waiver-profile"><option value="">Choose profile</option>'+profileOptions+'</select></div>'+
      '<div class="ra-field"><label>Requirement</label><select id="ra-faction-waiver-requirement"><option value="">Choose requirement</option>'+requirementOptions+'</select></div>'+
      '<div class="ra-field"><label>Review</label><input id="ra-faction-waiver-review" type="datetime-local"></div>'+
      '<div class="ra-field" style="grid-column:1/-1"><label>Reason</label><textarea id="ra-faction-waiver-reason" placeholder="Why is this individual exception approved?"></textarea></div></div>'+
      '<div class="ra-actions"><button type="button" class="ra-btn ra-primary" id="ra-faction-waiver-grant">Grant Waiver</button></div>'+
      '<div class="ra-table-wrap" style="margin-top:12px"><table class="ra-table"><thead><tr><th>Candidate</th><th>Baseline status</th><th>Active waivers</th></tr></thead><tbody>'+(candidateStatus||'<tr><td colspan="3">No Faction candidates.</td></tr>')+'</tbody></table></div>'+
      '<div class="ra-table-wrap" style="margin-top:12px"><table class="ra-table"><thead><tr><th>Candidate</th><th>Requirement</th><th>Context</th><th>Reason</th><th>State</th><th>Review</th><th>Resolution</th><th>Action</th></tr></thead><tbody>'+(history||'<tr><td colspan="8">No waiver history.</td></tr>')+'</tbody></table></div></section>';
  }

`;

replaceOnce(uiPath,
  '  function renderRequirementsPage({config={},profiles=[]}={}){',
  waiverUiHelper+'  function renderRequirementsPage({config={},profiles=[],rows=[]}={}){'
);
replaceOnce(uiPath,
  "No specialist profiles yet.</div></section>'}`;",
  "No specialist profiles yet.</div></section>'}${renderWaiverManagement({baseline,profiles,rows})}`;"
);

const waiverPlatformFunctions=`
  async function grantWaiverFromUi(){
    const userId=text(document.getElementById('ra-faction-waiver-player')?.value);
    if(!userId)throw new Error('Choose a Faction candidate.');
    const row=await rowFor(userId);
    const context=text(document.getElementById('ra-faction-waiver-context')?.value).toLowerCase()==='specialist'?'specialist':'baseline';
    const profileId=context==='specialist'?text(document.getElementById('ra-faction-waiver-profile')?.value):'';
    if(context==='specialist'&&!profileId)throw new Error('Choose a specialist profile for this waiver.');
    const requirementId=text(document.getElementById('ra-faction-waiver-requirement')?.value);
    if(!requirementId)throw new Error('Choose a requirement to waive.');
    const reason=text(document.getElementById('ra-faction-waiver-reason')?.value);
    if(!reason)throw new Error('A waiver reason is required.');
    const[config,profiles]=await Promise.all([getConfig(runtime.app),getProfiles(runtime.app)]);
    const baseline=FactionCore.normalizeBaseline(config.baseline||{});
    const profile=context==='specialist'?profiles.map(FactionCore.normalizeSpecialistProfile).find(item=>text(item.profileId)===profileId):null;
    if(context==='specialist'&&!profile)throw new Error('Specialist profile was not found.');
    const criteria=context==='specialist'?(profile.criteria||[]):baseline.criteria;
    if(!criteria.some(item=>text(item.id)===requirementId))throw new Error('The selected requirement does not belong to the selected waiver context.');
    const duplicate=(row.factionRecord.waivers||[]).some(item=>text(item.state)==='Active'&&text(item.requirementId)===requirementId&&text(item.context)===context&&text(item.profileId)===profileId);
    if(duplicate)throw new Error('This requirement already has an active waiver for the candidate.');
    const reviewRaw=text(document.getElementById('ra-faction-waiver-review')?.value);
    let reviewAt=null;
    if(reviewRaw){reviewAt=Date.parse(reviewRaw);if(!Number.isFinite(reviewAt))throw new Error('Choose a valid waiver review date and time.');}
    const next=Operations.grantWaiver(row.factionRecord,{requirementId,context,profileId,reason,reviewAt},Date.now());
    return saveOperationalRecord(userId,next);
  }

  async function resolveWaiverFromUi(userId,waiverId){
    const row=await rowFor(userId);
    const waiver=(row.factionRecord.waivers||[]).find(item=>text(item.waiverId)===text(waiverId));
    if(!waiver)throw new Error('Waiver not found.');
    if(text(waiver.state)!=='Active')throw new Error('Only an active waiver can be resolved.');
    const answer=globalThis.prompt?globalThis.prompt('Resolution reason (optional)',''):'';
    if(answer==null)return false;
    const next=Operations.resolveWaiver(row.factionRecord,waiverId,text(answer),Date.now());
    return saveOperationalRecord(userId,next);
  }

`;

replaceOnce(platformPath,
  '  function openManualMessage(row,override=false){',
  waiverPlatformFunctions+'  function openManualMessage(row,override=false){'
);

const waiverControlHelper=`
  function syncWaiverControls(){
    const contextSelect=document.getElementById('ra-faction-waiver-context');
    const profileSelect=document.getElementById('ra-faction-waiver-profile');
    const requirementSelect=document.getElementById('ra-faction-waiver-requirement');
    if(!contextSelect||!profileSelect||!requirementSelect)return;
    const context=text(contextSelect.value).toLowerCase()==='specialist'?'specialist':'baseline';
    const profileId=text(profileSelect.value);
    profileSelect.disabled=context!=='specialist';
    let first='';let currentAllowed=false;
    [...requirementSelect.options].forEach(option=>{
      if(!option.value)return;
      const optionContext=text(option.dataset.waiverContext)||'baseline';
      const optionProfile=text(option.dataset.waiverProfile);
      const allowed=optionContext===context&&(context!=='specialist'||!profileId||optionProfile===profileId);
      option.hidden=!allowed;option.disabled=!allowed;
      if(allowed&&!first)first=option.value;
      if(allowed&&option.value===requirementSelect.value)currentAllowed=true;
    });
    if(!currentAllowed)requirementSelect.value=first;
  }

`;
replaceOnce(platformPath,
  '  function bindContentControls(){',
  waiverControlHelper+'  function bindContentControls(){'
);

const waiverBindings=`
    const waiverContext=document.getElementById('ra-faction-waiver-context');if(waiverContext)waiverContext.onchange=syncWaiverControls;
    const waiverProfile=document.getElementById('ra-faction-waiver-profile');if(waiverProfile)waiverProfile.onchange=syncWaiverControls;
    syncWaiverControls();
    const waiverGrant=document.getElementById('ra-faction-waiver-grant');if(waiverGrant)waiverGrant.onclick=async()=>{try{await grantWaiverFromUi();await renderPage('faction-requirements',{persist:false});}catch(error){reportError(error);}};
    document.querySelectorAll('[data-faction-waiver-resolve]').forEach(button=>button.onclick=async()=>{try{const changed=await resolveWaiverFromUi(button.dataset.factionWaiverPlayer,button.dataset.factionWaiverResolve);if(changed!==false)await renderPage('faction-requirements',{persist:false});}catch(error){reportError(error);}});
`;
replaceOnce(platformPath,
  "    document.querySelectorAll('[data-faction-remove-criterion]').forEach(button=>button.onclick=()=>button.closest('[data-faction-criterion-row]')?.remove());\n",
  "    document.querySelectorAll('[data-faction-remove-criterion]').forEach(button=>button.onclick=()=>button.closest('[data-faction-criterion-row]')?.remove());\n"+waiverBindings
);

replaceOnce(platformPath,
  "    else if(page==='faction-requirements')content.innerHTML=FactionUI.renderRequirementsPage({config,profiles});",
  "    else if(page==='faction-requirements')content.innerHTML=FactionUI.renderRequirementsPage({config,profiles,rows});"
);

console.log('v4.7 Faction waiver UI/platform patch applied.');
