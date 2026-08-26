(function(root,factory){
  let Workflow=root&&root.RA_V47FactionWorkflow;
  if(!Workflow&&typeof module==='object'&&module.exports)Workflow=require('./v47-faction-workflow');
  const api=factory(Workflow);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RA_V47FactionWorkflowUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Workflow){
  'use strict';
  if(!Workflow)throw new Error('Faction Workflow is required.');

  const text=value=>String(value??'').trim();
  const number=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const unique=values=>[...new Set((Array.isArray(values)?values:[]).map(text).filter(Boolean))];
  const terminal=new Set(['Joined','Rejected']);
  const dateText=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?new Date(n).toLocaleString():'—';};
  const candidateOptions=(rows=[],selected='',filter=()=>true)=>rows.filter(filter).map(row=>`<option value="${esc(row.userId)}" ${text(row.userId)===text(selected)?'selected':''}>${esc(row.name)} [${esc(row.userId)}]</option>`).join('');
  const profileOptions=(profiles=[],selected='')=>`<option value="">No specialist profile</option>`+profiles.map(profile=>`<option value="${esc(profile.profileId)}" ${text(profile.profileId)===text(selected)?'selected':''}>${esc(profile.name||profile.profileId)}</option>`).join('');
  const rowMap=rows=>new Map((rows||[]).map(row=>[text(row.userId),row]));

  function renderCampaignsPage({campaigns=[],rows=[],profiles=[]}={}){
    const players=rowMap(rows);
    const cards=(campaigns||[]).map(campaign=>{
      const ids=unique(campaign.candidateIds);const members=ids.map(id=>players.get(id)).filter(Boolean);const available=rows.filter(row=>!ids.includes(text(row.userId)));
      return `<section class="ra-panel" data-faction-campaign-card="${esc(campaign.campaignId)}"><div class="ra-panel-head"><div><h3>${esc(campaign.title||'Untitled Campaign')}</h3><p>${esc(campaign.target||'No target specified')} · ${esc(campaign.status||'Draft')}</p></div></div><div class="ra-formgrid"><div class="ra-field"><label>Title</label><input data-faction-campaign-field="title" value="${esc(campaign.title)}"></div><div class="ra-field"><label>Target</label><input data-faction-campaign-field="target" value="${esc(campaign.target)}"></div><div class="ra-field"><label>Specialist Profile</label><select data-faction-campaign-field="profileId">${profileOptions(profiles,campaign.profileId)}</select></div><div class="ra-field"><label>Status</label><select data-faction-campaign-field="status"><option ${campaign.status==='Draft'?'selected':''}>Draft</option><option ${campaign.status==='Active'?'selected':''}>Active</option><option ${campaign.status==='Paused'?'selected':''}>Paused</option><option ${campaign.status==='Completed'?'selected':''}>Completed</option><option ${campaign.status==='Archived'?'selected':''}>Archived</option></select></div><div class="ra-field" style="grid-column:1/-1"><label>Notes</label><textarea data-faction-campaign-field="notes">${esc(campaign.notes)}</textarea></div></div><div class="ra-actions"><button class="ra-btn ra-primary" data-faction-campaign-save="${esc(campaign.campaignId)}">Save Campaign</button><button class="ra-btn ra-danger" data-faction-campaign-delete="${esc(campaign.campaignId)}">Delete</button></div><h4>Members</h4><div>${members.map(row=>`<div class="ra-actions" style="justify-content:space-between;margin:4px 0"><span>${esc(row.name)} <span class="ra-muted">[${esc(row.userId)}]</span></span><button class="ra-btn ra-danger" data-faction-campaign-remove-member="${esc(campaign.campaignId)}" data-faction-campaign-user="${esc(row.userId)}">Remove</button></div>`).join('')||'<div class="ra-muted">No members.</div>'}</div><div class="ra-actions" style="margin-top:8px"><select class="ra-btn" data-faction-campaign-member-select="${esc(campaign.campaignId)}"><option value="">Add candidate…</option>${candidateOptions(available)}</select><button class="ra-btn" data-faction-campaign-add-member="${esc(campaign.campaignId)}">Add Member</button></div></section>`;
    }).join('');
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Create Faction Campaign</h3><p>Campaign membership is many-to-many and may optionally target one specialist profile.</p></div></div><div class="ra-formgrid"><div class="ra-field"><label>Title</label><input id="ra-faction-campaign-title"></div><div class="ra-field"><label>Target</label><input id="ra-faction-campaign-target"></div><div class="ra-field"><label>Specialist Profile</label><select id="ra-faction-campaign-profile">${profileOptions(profiles)}</select></div><div class="ra-field"><label>Status</label><select id="ra-faction-campaign-status"><option>Draft</option><option>Active</option><option>Paused</option><option>Completed</option><option>Archived</option></select></div><div class="ra-field" style="grid-column:1/-1"><label>Notes</label><textarea id="ra-faction-campaign-notes"></textarea></div></div><div class="ra-actions" style="margin-top:8px"><button class="ra-btn ra-primary" id="ra-faction-campaign-new">Create Campaign</button></div></section>${cards||'<section class="ra-panel"><div class="ra-muted">No Faction campaigns yet.</div></section>'}`;
  }

  function renderFollowUpsPage(rows=[]){
    const pending=[];
    for(const row of rows||[])for(const item of row.followUps||[])if(!['completed','cancelled'].includes(text(item.state).toLowerCase()))pending.push({row,item});
    pending.sort((a,b)=>number(a.item.dueAt,Infinity)-number(b.item.dueAt,Infinity));
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Add Faction Follow-up</h3><p>Follow-ups are workflow reminders, not stage changes.</p></div></div><div class="ra-formgrid"><div class="ra-field"><label>Candidate</label><select id="ra-faction-followup-player"><option value="">Choose candidate…</option>${candidateOptions(rows)}</select></div><div class="ra-field"><label>Due</label><input id="ra-faction-followup-due" type="datetime-local"></div><div class="ra-field"><label>Reason</label><input id="ra-faction-followup-reason"></div><div class="ra-field"><label>Note</label><input id="ra-faction-followup-note"></div><div class="ra-field"><label>Recurrence</label><select id="ra-faction-followup-recurrence-unit"><option value="">None</option><option value="days">Days</option><option value="weeks">Weeks</option></select></div><div class="ra-field"><label>Every</label><input id="ra-faction-followup-recurrence-interval" type="number" min="1" value="1"></div></div><div class="ra-actions" style="margin-top:8px"><button class="ra-btn ra-primary" id="ra-faction-followup-add">Add Follow-up</button></div></section><section class="ra-panel"><h3>Pending Follow-ups</h3>${pending.map(({row,item})=>`<div class="ra-actions" style="justify-content:space-between;margin:6px 0"><div><b>${esc(row.name)}</b> · ${esc(dateText(item.dueAt))}<div class="ra-note">${esc(item.reason||'No reason')}${item.note?` · ${esc(item.note)}`:''}</div></div><button class="ra-btn" data-faction-followup-complete="${esc(item.followUpId)}" data-faction-followup-user="${esc(row.userId)}">Complete</button></div>`).join('')||'<div class="ra-muted">No pending follow-ups.</div>'}</section>`;
  }

  function renderTimelinePage(rows=[]){
    const options=candidateOptions(rows);
    const panels=rows.map(row=>{
      const events=(row.factionRecord?.timelineEvents||[]).map(event=>`<div class="ra-panel" style="margin:6px 0"><b>System event</b> · ${esc(event.type)} · ${esc(dateText(event.at))}<div class="ra-note">${esc(JSON.stringify(event.payload||{}))}</div></div>`).join('');
      const notes=(row.factionRecord?.timelineNotes||[]).map(note=>`<div class="ra-panel" style="margin:6px 0"><b>Recruiter note</b> · ${esc(dateText(note.at))}<div class="ra-note">${esc(note.text)}</div><div class="ra-actions"><button class="ra-btn" data-faction-note-edit="${esc(note.noteId)}" data-faction-note-user="${esc(row.userId)}">Edit</button><button class="ra-btn ra-danger" data-faction-note-delete="${esc(note.noteId)}" data-faction-note-user="${esc(row.userId)}">Delete</button></div></div>`).join('');
      return `<section class="ra-panel"><h3>${esc(row.name)}</h3>${events}${notes||(!events?'<div class="ra-muted">No timeline entries.</div>':'')}</section>`;
    }).join('');
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Faction Timeline</h3><p>System events are immutable. Recruiter notes may be edited or deleted.</p></div></div><div class="ra-formgrid"><div class="ra-field"><label>Candidate</label><select id="ra-faction-timeline-player"><option value="">Choose candidate…</option>${options}</select></div><div class="ra-field"><label>Recruiter note</label><input id="ra-faction-timeline-note"></div></div><div class="ra-actions" style="margin-top:8px"><button class="ra-btn ra-primary" id="ra-faction-timeline-add">Add Recruiter Note</button></div></section>${panels}`;
  }

  function renderContactOutcomesPage(rows=[]){
    const outcomeRows=[];
    for(const row of rows||[])for(const outcome of row.outcomes||[])outcomeRows.push({row,outcome});
    const dncRows=rows.map(row=>{
      const enabled=row.doNotContact===true||row.factionRecord?.doNotContact===true;
      const reason=text(row.doNotContactReason||row.factionRecord?.doNotContactReason);
      return `<div class="ra-panel" style="margin:6px 0"><b>${esc(row.name)}</b> · ${enabled?'Do Not Contact':'Contact permitted'}<div class="ra-note">${esc(reason||'No DNC reason')}</div><div class="ra-actions"><input data-faction-dnc-reason="${esc(row.userId)}" value="${esc(reason)}" placeholder="Reason"><button class="ra-btn ${enabled?'':'ra-danger'}" data-faction-dnc-toggle="${esc(row.userId)}" data-faction-dnc-enabled="${enabled?'false':'true'}">${enabled?'Clear DNC':'Set Do Not Contact'}</button>${enabled?'<span class="ra-muted">Override messaging remains deliberate and manual.</span>':''}</div></div>`;
    }).join('');
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Faction Contact Outcomes</h3><p>Contact result and Do Not Contact are independent from Faction pipeline stage.</p></div></div><div class="ra-formgrid"><div class="ra-field"><label>Candidate</label><select id="ra-faction-outcome-player"><option value="">Choose candidate…</option>${candidateOptions(rows)}</select></div><div class="ra-field"><label>Result</label><select id="ra-faction-outcome-result"><option>Interested</option><option>Maybe later</option><option>Not interested</option><option>No response</option><option>Other</option></select></div><div class="ra-field"><label>Channel</label><select id="ra-faction-outcome-channel"><option>Mail</option><option>Chat</option><option>Forum</option><option>Other</option></select></div><div class="ra-field"><label>Note</label><input id="ra-faction-outcome-note"></div></div><div class="ra-actions" style="margin-top:8px"><button class="ra-btn ra-primary" id="ra-faction-outcome-add">Record Outcome</button></div></section><section class="ra-panel"><h3>Do Not Contact</h3>${dncRows}</section><section class="ra-panel"><h3>Contact Outcomes</h3>${outcomeRows.map(({row,outcome})=>`<div>${esc(row.name)} · ${esc(outcome.result)} · ${esc(outcome.channel)} · ${esc(dateText(outcome.at))}</div>`).join('')||'<div class="ra-muted">No outcomes recorded.</div>'}</section>`;
  }

  function renderStageAgingPage(rows=[]){
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Faction Stage Aging</h3><p>Warning-only review. Aging never moves a candidate automatically.</p></div></div><div class="ra-table-wrap"><table class="ra-table"><thead><tr><th>Player</th><th>Stage</th><th>Age</th><th>Threshold</th><th>Status</th></tr></thead><tbody>${rows.map(row=>{const a=row.stageAging||{};return`<tr><td>${esc(row.name)}</td><td>${esc(row.pipelineStage)}</td><td>${number(a.daysInStage)} days</td><td>${number(a.thresholdDays)} days</td><td>${a.stale?'Stale':'Within threshold'}</td></tr>`;}).join('')||'<tr><td colspan="5">No candidates.</td></tr>'}</tbody></table></div></section>`;
  }

  function renderReactivationPage(rows=[]){
    const eligible=rows.filter(row=>row.archived===true||terminal.has(text(row.pipelineStage)));
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Faction Reactivation</h3><p>Start a new Faction recruitment cycle without creating another player identity.</p></div></div>${eligible.map(row=>`<div class="ra-panel" style="margin:6px 0"><b>${esc(row.name)}</b> <span class="ra-muted">[${esc(row.userId)}] · ${esc(row.pipelineStage)}</span><div class="ra-formgrid" style="margin-top:6px"><div class="ra-field"><label>Reason</label><input data-faction-reactivate-reason="${esc(row.userId)}" placeholder="Why reopen this candidate?"></div><div class="ra-field"><label>Previous cycles</label><input disabled value="${number(row.factionRecord?.cycles?.length,0)}"></div></div><div class="ra-actions" style="margin-top:6px"><button class="ra-btn ra-primary" data-faction-reactivate-player="${esc(row.userId)}">Start New Cycle</button></div></div>`).join('')||'<div class="ra-muted">No candidates are currently eligible for reactivation.</div>'}</section>`;
  }

  function renderRecruitmentSessionsPage({sessions=[],rows=[]}={}){
    const players=rowMap(rows);const activeCandidates=rows.filter(row=>!row.archived&&!terminal.has(text(row.pipelineStage)));
    const cards=(sessions||[]).map(session=>{
      const currentId=Workflow.currentSessionCandidate(session);const current=players.get(text(currentId));const progress=`${Math.min(number(session.cursor,0),unique(session.candidateIds).length)}/${unique(session.candidateIds).length}`;
      return `<section class="ra-panel" data-faction-session-card="${esc(session.sessionId)}"><div class="ra-panel-head"><div><h3>${esc(session.title||'Recruitment Session')}</h3><p>${esc(session.status||'Draft')} · ${esc(progress)}</p></div></div>${current?`<div class="ra-kpi"><span>Current candidate</span><b>${esc(current.name)}</b><div class="ra-note">${esc(current.userId)} · ${esc(current.pipelineStage)}</div></div><div class="ra-field" style="margin-top:8px"><label>Action note</label><input data-faction-session-note="${esc(session.sessionId)}"></div><div class="ra-actions" style="margin-top:8px"><button class="ra-btn" data-faction-session-action="${esc(session.sessionId)}" data-faction-session-user="${esc(current.userId)}" value="Contacted">Contacted</button><button class="ra-btn" data-faction-session-action="${esc(session.sessionId)}" data-faction-session-user="${esc(current.userId)}" value="Evaluating">Evaluating</button><button class="ra-btn" data-faction-session-action="${esc(session.sessionId)}" data-faction-session-user="${esc(current.userId)}" value="Deferred">Deferred</button><button class="ra-btn" data-faction-session-action="${esc(session.sessionId)}" data-faction-session-user="${esc(current.userId)}" value="Skip">Skip</button></div>`:'<div class="ra-muted">No current candidate. Session is complete or empty.</div>'}<details style="margin-top:8px"><summary>Session history</summary>${(session.outcomes||[]).map(outcome=>`<div>${esc(outcome.userId)} · ${esc(outcome.action)}${outcome.note?` · ${esc(outcome.note)}`:''}</div>`).join('')||'<div class="ra-muted">No actions yet.</div>'}</details></section>`;
    }).join('');
    return `<section class="ra-panel"><div class="ra-panel-head"><div><h3>Create Faction Recruitment Session</h3><p>Sessions process a frozen Faction candidate queue one explicit action at a time.</p></div></div><div class="ra-formgrid"><div class="ra-field"><label>Title</label><input id="ra-faction-session-title"></div><div class="ra-field"><label>Candidate source</label><select id="ra-faction-session-source"><option value="active">All active Faction candidates (${activeCandidates.length})</option></select></div></div><div class="ra-actions" style="margin-top:8px"><button class="ra-btn ra-primary" id="ra-faction-session-new">Create Session</button></div></section>${cards||'<section class="ra-panel"><div class="ra-muted">No recruitment sessions yet.</div></section>'}`;
  }

  return Object.freeze({
    renderCampaignsPage,
    renderFollowUpsPage,
    renderTimelinePage,
    renderContactOutcomesPage,
    renderStageAgingPage,
    renderReactivationPage,
    renderRecruitmentSessionsPage
  });
});
