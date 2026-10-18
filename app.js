import {reportLogo} from './report-branding.js';
import {scenarioName,canReview,summaryMarkup} from './scenario-summary.js';
import {displayDate} from './format.js';
import {openEventEditor} from './event-editor.js';
import {documentHtml} from './case-document.js';
import {eventsMarkup} from './events-view.js';
import {nativeIcon} from './icons.js';
﻿import {config} from './config.js';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states=['Proposal','Reviewing','Accepted','Applied','Retired'];
let auth=null;try{auth=JSON.parse(sessionStorage.getItem('ekwo-lustre-session')||'null')}catch{sessionStorage.removeItem('ekwo-lustre-session')}
let companies=[],companyId=null,caseId=null,overview={cases:[],batches:[]},busy=false,saveEditor=null,eventReview=null,eventMode='journal',eventLevel='summary',workspaceKind='case';
let restoringHistory=false;
function rememberView(){
 const view={lustreView:true,workspaceKind,company:companyId,case:caseId,scenario:eventReview?.company===companyId&&eventReview?.case===caseId?eventReview.scenario.id:null};
 if(restoringHistory||pendingHistory)return;
 if(!history.state?.lustreView)history.replaceState(view,'');
 else if(JSON.stringify(history.state)!==JSON.stringify(view))history.pushState(view,'');
}
let pendingHistory=null;
async function restoreView(view){
 restoringHistory=true;
 try{
  workspaceKind=view.workspaceKind==='forecast'?'forecast':'case';companyId=companies.some(c=>c.id===view.company)?view.company:null;caseId=view.case;eventReview=null;
  companyPicker();sidebar();await refresh();
  const c=overview.cases.find(c=>c.id===caseId),s=c?.scenarios?.find(s=>s.id===view.scenario);
  if(c&&s)await openEvents(c,s);
 }finally{restoringHistory=false;}
}
window.addEventListener('popstate',e=>{if(!auth||!e.state?.lustreView)return;if(busy){pendingHistory=e.state;return;}task(()=>restoreView(e.state));});
const nativeBase='https://cloud.ekwo.ai';
const nativeUrl=path=>companyId?`${nativeBase}/c/${encodeURIComponent(companyId)}${path?'/'+path:''}`:nativeBase+'/';
function notice(text='',error=false){$('status').hidden=!text;$('status').textContent=text;$('status').className=error?'error':'';}
async function api(path,body,method='POST'){
 if(auth?.expires_at&&auth.expires_at<Date.now()/1000+60){const r=await fetch(config.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:auth.refresh_token})});if(!r.ok){logout();throw Error('Please sign in again');}auth=await r.json();sessionStorage.setItem('ekwo-lustre-session',JSON.stringify(auth));}
 const r=await fetch(config.url+path,{method,headers:{apikey:config.publishableKey,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text(),data=text?JSON.parse(text):null;if(!r.ok)throw Error(data?.message||data?.error_description||'Request failed');return data;
}
const rpc=(name,args)=>api('/rest/v1/rpc/lustre_'+name,args);
async function task(fn){if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');notice();try{await fn()}catch(e){if($('editor').open)$('editor-error').textContent=e.message;else notice(e.message,true)}finally{busy=false;document.body.removeAttribute('aria-busy');if(pendingHistory){const view=pendingHistory;pendingHistory=null;task(()=>restoreView(view));}}}
function logout(){auth=null;companyId=null;caseId=null;companies=[];overview={cases:[],batches:[]};sessionStorage.removeItem('ekwo-lustre-session');$('workspace').hidden=true;$('sign-out').hidden=true;$('content').replaceChildren();$('company-options').replaceChildren();$('side-menu').replaceChildren();$('company-name').textContent='Choose a company';$('editor').close();location.replace('sign-in.html');}
$('sign-out').onclick=logout;
function flag(code){return /^[A-Z]{2}$/.test(code||'')?String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))):'';}
function companyPicker(){const selected=companies.find(c=>c.id===companyId);$('company-name').textContent=selected?.name||'Choose a company';$('company-toggle').title=selected?.name||'Choose a company';$('company-options').innerHTML=companies.map(c=>`<button class="company-option" data-company="${esc(c.id)}" ${c.id===companyId?'aria-current="true"':''}><span class="tick">${c.id===companyId?'&#10003;':''}</span><span class="name">${esc(c.name)}</span><span class="country" title="${esc(c.country)}">${esc(new Intl.DisplayNames(['en'],{type:'region'}).of(c.country))}</span></button>`).join('');$('company-options').querySelectorAll('button').forEach(b=>b.onclick=()=>task(()=>selectCompany(b.dataset.company)));}
$('all-companies').onclick=e=>{e.preventDefault();task(async()=>{companyId=null;caseId=null;closeCompanies();companyPicker();sidebar();await refresh()})};
function closeCompanies(){ $('company-menu').hidden=true;$('company-toggle').setAttribute('aria-expanded','false');}
$('company-toggle').onclick=()=>{const open=$('company-menu').hidden;$('company-menu').hidden=!open;$('company-toggle').setAttribute('aria-expanded',String(open));if(open)$('company-options').querySelector('button')?.focus();};
document.addEventListener('click',e=>{if(!e.target.closest('.company-switch'))closeCompanies()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCompanies();if(e.target.matches('.company-option')&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const bs=[...$('company-options').querySelectorAll('button')],i=bs.indexOf(e.target);bs[(i+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length]?.focus();}});
const icon=path=>`<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
const box='M4 5h16v15H4z M4 10h16 M9 10v10';
function sidebar(){const groups=[['Day to day',[['Overview','','M3 11 12 3l9 8 M5 10v11h14V10'],['Sales','sales',box],['Purchases','purchases',box],['Bank','bank','M3 9h18L12 3z M5 9v11m7-11v11m7-11v11M3 21h18'],['Contacts','contacts','M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 21v-3a8 8 0 0 1 16 0v3']]],['Accounting',[['Matching','matching',box],['Statements','statements',box],['Year end','year-end',box],['Chart of accounts','accounts',box],['Import','import',box]]],['Practitioner',[['Cases','cases',box],['Forecast','forecast',box]]],['CFO',[['Cockpit','cockpit',box],['Products','products',box]]]];
 $('side-menu').innerHTML=groups.map(([name,items])=>`<div class="nav-group">${name}</div>`+items.map(([label,path,glyph])=>['cases','forecast'].includes(path)?`<a href="#${path}" ${((workspaceKind==='forecast')===(path==='forecast'))?'class="active" aria-current="page"':''} id="${path}-nav">${path==='cases'?'<img class="nav-icon" src="poppy.svg" alt="">':nativeIcon('compass')}<span class="nav-label">${label}</span></a>`:`<a href="${nativeUrl(path)}" target="_blank" rel="noopener" ${companyId?'':'aria-disabled="true"'}>${nativeIcon({'':'layout-dashboard',sales:'file-text',purchases:'shopping-bag',bank:'landmark',contacts:'book-user',matching:'link-2',statements:'scale','year-end':'calendar-check',accounts:'book-open',import:'upload',cockpit:'compass',products:'package'}[path])}<span class="nav-label">${label}</span></a>`).join('')).join('')+`<div class="nav-group"></div><a href="${nativeUrl('settings')}" target="_blank" rel="noopener" ${companyId?'':'aria-disabled="true"'}>${nativeIcon('settings')}<span class="nav-label">Settings</span></a>`;
 document.querySelectorAll('#side-menu a').forEach(a=>a.title=a.textContent.trim());for(const kind of ['case','forecast'])$(kind==='case'?'cases-nav':'forecast-nav').onclick=e=>{e.preventDefault();task(async()=>{workspaceKind=kind;caseId=null;eventReview=null;sidebar();await refresh();});};}
async function start(){companies=await api('/rest/v1/companies?select=id,name,legal_name,country,currency_code,language&order=name',null,'GET');const stored=sessionStorage.getItem('ekwo-lustre-company:'+auth.user.id);companyId=companies.some(c=>c.id===stored)?stored:companies.length===1?companies[0].id:null;$('account-name').textContent=auth.user.email;$('workspace').hidden=false;$('sign-out').hidden=false;companyPicker();sidebar();await refresh();}
async function selectCompany(id){if(!companies.some(c=>c.id===id))return;companyId=id;caseId=null;sessionStorage.setItem('ekwo-lustre-company:'+auth.user.id,id);closeCompanies();companyPicker();sidebar();await refresh();}
async function refresh(){if(eventReview&&eventReview.company!==companyId)eventReview=null;if(eventReview){const snapshot=await rpc('scenario_snapshot',{p_company:companyId,p_scenario:eventReview.scenario.id});if(canReview(snapshot?.health))Object.assign(eventReview,snapshot);else eventReview=null;}overview=companyId?await rpc('overview',{p_company:companyId}):{cases:[],batches:[]};if(caseId&&!overview.cases.some(c=>c.id===caseId))caseId=null;render();}
function action(id,label){return `<button id="${id}">${label}</button>`;}
function render(){rememberView();notice();$('breadcrumb').textContent=workspaceKind==='forecast'?'FORECAST':'CASES';$('page-actions').innerHTML='';if(!companyId){$('page-title').textContent='Companies';$('content').innerHTML=companies.length?`<div class="company-grid">${companies.map(c=>`<button class="company-card" data-company="${c.id}"><strong>${esc(c.name)}</strong><span class="country">${flag(c.country)} ${esc(c.country)}</span></button>`).join('')}</div>`:'<p class="empty">No companies.</p>';$('content').querySelectorAll('[data-company]').forEach(b=>b.onclick=()=>task(()=>selectCompany(b.dataset.company)));return;}
 const selectedCase=overview.cases.find(c=>c.id===caseId);if(selectedCase){if(eventReview?.company===companyId&&eventReview?.case===caseId){const current=selectedCase.scenarios.find(s=>s.id===eventReview.scenario.id);if(current){eventReview.scenario=current;return renderEvents(selectedCase);}eventReview=null;}return renderCase(selectedCase);}eventReview=null;
 const listedCases=overview.cases.filter(c=>(c.kind||'case')===workspaceKind);
 $('page-title').textContent=workspaceKind==='forecast'?'Forecast':'Cases';if(overview.can_write&&workspaceKind==='case'){$('page-actions').innerHTML=action('new-case','New case');$('new-case').onclick=()=>editCase();}
 $('content').innerHTML=listedCases.length?`<div class="case-table"><table><thead><tr><th>Case</th><th>Scenarios</th><th>Selected</th></tr></thead><tbody>${listedCases.map(c=>`<tr><td><button class="text-button" data-case="${c.id}">${esc(c.name)}</button></td><td>${c.scenarios?.length||0}</td><td>${esc(c.scenarios?.find(s=>s.id===c.selected_scenario_id)?.name||'')}</td></tr>`).join('')}</tbody></table></div>`:`<p class="empty">${workspaceKind==='forecast'?'No forecasts. A source budget is required.':'No cases.'}</p>`;
 $('content').querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>task(async()=>{caseId=b.dataset.case;await refresh()}));}
function statusOptions(current){return [...new Set([...states,current])].filter(Boolean).map(s=>`<option ${s===current?'selected':''}>${esc(s)}</option>`).join('');}
function renderCase(c){$('page-title').textContent=c.name;$('breadcrumb').innerHTML='<a href="#cases" id="back-cases">'+(c.kind==='forecast'?'Forecast':'Cases')+'</a> / '+esc(c.name);$('page-actions').innerHTML=action('case-document','Report')+action('clear-selection','Use baseline')+(overview.can_write?action('edit-case','Case details')+(c.kind==='forecast'?'':action('new-scenario','New scenario')):'');$('clear-selection').onclick=()=>task(async()=>{await rpc('select',{p_company:companyId,p_case:c.id,p_scenario:null});await refresh()});if(overview.can_write){$('edit-case').onclick=()=>editCase(c);if($('new-scenario'))$('new-scenario').onclick=()=>editScenario(c);}
 $('content').innerHTML=`<div class="case-table"><table><thead><tr><th>Scenario</th><th>Status</th><th>Selected</th><th>Entries</th><th></th></tr></thead><tbody>${(c.scenarios||[]).map(s=>`<tr><td>${scenarioName(s)}</td><td><span class="state">${esc(s.status||'Proposal')}</span></td><td><label class="selection"><input type="radio" name="scenario-selection" data-select="${s.id}" aria-label="Select ${esc(s.name)}" ${c.selected_scenario_id===s.id?'checked':''}></label></td><td><button class="text-button" data-events="${s.id}" ${canReview(s.health)?'':'disabled'} aria-label="Events for ${esc(s.name)}">${s.summary_entries?`${s.summary_entries}/`:""}${s.entries}</button></td><td><div class="row-actions">${overview.can_write?`<button data-edit="${s.id}">Edit</button><button data-copy="${s.id}">Copy</button>`:''}<button data-events="${s.id}" ${canReview(s.health)?'':'disabled'}>Events</button></div></td></tr>`).join('')}</tbody></table></div>`;
 $('case-document').onclick=()=>task(()=>openCaseDocument(c));
 if(overview.can_write&&c.kind!=='forecast'){$('page-actions').insertAdjacentHTML('afterbegin',action('capture-case',overview.active_case_id===c.id?'Stop capture':'Use for capture'));$('capture-case').onclick=()=>task(async()=>{await rpc('capture_case',{p_company:companyId,p_case:overview.active_case_id===c.id?null:c.id});await refresh();});}
 if(c.notes)$('content').insertAdjacentHTML('afterbegin',`<details class="case-description"><summary>Case description</summary><div class="description-text">${esc(c.notes)}</div></details>`);
 if(overview.active_case_id===c.id)$('content').insertAdjacentHTML('afterbegin','<p class="capture-state">Active case for capture</p>');
 for(const el of $('content').querySelectorAll('[data-events]'))el.onclick=()=>task(()=>openEvents(c,c.scenarios.find(s=>s.id===el.dataset.events)));
 $('back-cases').onclick=e=>{e.preventDefault();caseId=null;render()};
 for(const el of $('content').querySelectorAll('[data-select]'))el.onchange=()=>task(async()=>{await rpc('select',{p_company:companyId,p_case:c.id,p_scenario:el.dataset.select});await refresh()});
 for(const el of $('content').querySelectorAll('[data-edit]'))el.onclick=()=>editScenario(c,c.scenarios.find(s=>s.id===el.dataset.edit));
 for(const el of $('content').querySelectorAll('[data-copy]'))el.onclick=()=>copyScenario(c,c.scenarios.find(s=>s.id===el.dataset.copy));
 const owned=new Set(c.scenarios.map(s=>s.batch_id));let changed=true;while(changed){changed=false;for(const b of overview.batches||[])if(owned.has(b.copied_from)&&!owned.has(b.id)){owned.add(b.id);changed=true;}}
 const refs=(overview.batches||[]).filter(b=>b.is_reference&&owned.has(b.id));if(refs.length){const section=document.createElement('section');section.className='references';section.innerHTML='<h2>Reference batches</h2><div class="case-table"><table><thead><tr><th>Reference</th><th>Entries</th><th></th></tr></thead><tbody>'+refs.map(b=>'<tr><td>'+esc(b.name)+'</td><td>'+b.entries+'</td><td>'+(overview.can_write?'<button data-reference="'+b.id+'">Copy</button>':'')+'</td></tr>').join('')+'</tbody></table></div>';$('content').append(section);section.querySelectorAll('[data-reference]').forEach(button=>button.onclick=()=>{const b=refs.find(b=>b.id===button.dataset.reference);copyScenario(c,{name:b.name,batch_id:b.id});});}

}
async function openEvents(c,s){
 const company=companyId;const snapshot=await rpc('scenario_snapshot',{p_company:company,p_scenario:s.id});
 if(companyId!==company||caseId!==c.id)return;
 if(!canReview(snapshot?.health)){eventReview=null;await refresh();notice('Events review is unavailable until this scenario reconciles.');return;}
 eventReview={company,case:c.id,scenario:s,...snapshot};renderEvents(c);
}
function renderEvents(c){
 rememberView();
 const s=eventReview.scenario;
 $('page-title').textContent=s.name;
 $('breadcrumb').innerHTML=`<a href="#cases" id="events-cases">${c.kind==='forecast'?'Forecast':'Cases'}</a> / <a href="#case" id="events-case">${esc(c.name)}</a> / Events`;
 const capture=c.kind!=='forecast'&&overview.can_write&&overview.active_case_id===c.id&&c.selected_scenario_id===s.id;
 $('page-actions').innerHTML=(capture?action('add-event','Add event')+action('assign-event','Assign existing event'):'')+`<label class="events-switch"><select id="events-level" aria-label="Summary or detail"><option value="summary" ${eventLevel==='summary'?'selected':''}>Summary</option><option value="detail" ${eventLevel==='detail'?'selected':''}>Detail</option></select></label><label class="events-switch"><select id="events-view" aria-label="Events view"><option value="journal" ${eventMode==='journal'?'selected':''}>Journal</option><option value="accounts" ${eventMode==='accounts'?'selected':''}>T-accounts</option><option value="chart" ${eventMode==='chart'?'selected':''}>Accounts</option></select></label>`;
 $('content').innerHTML=(s.description?`<details class="scenario-description"><summary>Scenario description</summary><div class="description-text">${esc(s.description)}</div></details>`:'')+summaryMarkup(eventReview,eventMode,companies.find(c=>c.id===companyId)?.currency_code||'',eventLevel);
 for(const button of $('content').querySelectorAll('[data-account-open]'))button.onclick=()=>{const row=[...$('content').querySelectorAll('[data-account-detail]')].find(r=>r.dataset.accountDetail===button.dataset.accountOpen);row.hidden=!row.hidden;button.setAttribute('aria-expanded',String(!row.hidden));};
 if(capture){$('add-event').onclick=()=>task(()=>addEvent(s));$('assign-event').onclick=()=>assignEvent(s);}
 $('events-cases').onclick=e=>{e.preventDefault();eventReview=null;caseId=null;render();};
 $('events-case').onclick=e=>{e.preventDefault();eventReview=null;task(()=>refresh());};
 $('events-level').onchange=e=>{eventLevel=e.target.value;renderEvents(c);$('events-level').focus();};
 $('events-view').onchange=e=>{const expanded=$('content').querySelector('details')?.open;eventMode=e.target.value;renderEvents(c);const details=$('content').querySelector('details');if(details)details.open=!!expanded;$('events-view').focus();};
}
async function addEvent(s){
 const company=companyId;const accounts=await api('/rest/v1/accounts?select=id,code,name&company_id=eq.'+encodeURIComponent(company)+'&order=code',null,'GET');
 openEventEditor({editor,accounts,entries:eventReview.entries,save:async data=>{
  await rpc('event_create',{p_company:company,p_scenario:s.id,...data});
  eventReview.entries=await rpc('batch_entries',{p_company:company,p_batch:s.batch_id});
 }});
}
function assignEvent(s){
 const company=companyId;let reviewed=null,entry=null;
 editor('Assign existing event',`<p>Destination: ${esc(s.name)}</p><label>Reference or description<input id="assignment-query" autocomplete="off"></label><button type="button" id="assignment-search">Find events</button><div id="assignment-results"></div><div id="assignment-preview"></div>`,async()=>{
  if(!reviewed||!entry)throw Error('Find an event and review its assignment first.');
  await rpc('assign_event',{p_company:company,p_scenario:s.id,p_entry:entry,p_expected_batch:reviewed.source_batch,p_expected_ids:reviewed.ids});
  eventReview.entries=await rpc('batch_entries',{p_company:company,p_batch:s.batch_id});
 });
 $('assignment-search').onclick=()=>task(async()=>{
  reviewed=null;entry=null;$('assignment-preview').textContent='';
  const rows=await rpc('find_events',{p_company:company,p_query:$('assignment-query').value});
  $('assignment-results').innerHTML=rows.length?`<div class="event-scroll"><table><thead><tr><th></th><th>Date</th><th>Event</th><th>Batch</th><th>State</th></tr></thead><tbody>${rows.map(e=>`<tr><td><input type="radio" name="existing-event" data-existing="${esc(e.id)}" aria-label="Review ${esc(e.description)}"></td><td>${esc(displayDate(e.entry_date))}</td><td>${esc(e.description)}<br><small>${esc(e.reference)}</small></td><td>${esc(e.batch_name||'Unbatched')}</td><td>${esc(e.state)}</td></tr>`).join('')}</tbody></table></div>`:'<p>No matching events.</p>';
  for(const el of $('assignment-results').querySelectorAll('[data-existing]'))el.onchange=()=>task(async()=>{
   reviewed=null;entry=null;$('assignment-preview').textContent='';
   const preview=await rpc('assignment_preview',{p_company:company,p_entry:el.dataset.existing});
   reviewed=preview;entry=el.dataset.existing;
   $('assignment-preview').innerHTML=`<p>${preview.ids.length} event${preview.ids.length===1?'':'s'} will move to ${esc(s.name)}:</p><ul>${preview.events.map(e=>`<li>${esc(e.date)} · ${esc(e.description)}</li>`).join('')}</ul>`;
  });
 });
}
async function openCaseDocument(c){
 const [data,response]=await Promise.all([rpc('case_document',{p_company:companyId,p_case:c.id}),fetch('case-document.css')]);
 if(!data)throw Error('Case not found');if(!response.ok)throw Error('Document stylesheet unavailable');
 const branding=await reportLogo(data.company,{project:config.url,token:auth.access_token,key:config.publishableKey});data.company.report_logo_data=branding.logo;if(branding.warning)notice(branding.warning);
 const html=documentHtml(data,await response.text()),url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=data.case.name.replace(/[^a-z0-9 -]/gi,'').trim().slice(0,80)+'.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function editor(title,fields,save){$('editor-title').textContent=title;$('editor-fields').innerHTML=fields;$('editor-error').textContent='';saveEditor=save;$('editor').showModal();$('editor-fields').querySelector('input')?.focus();}
function editCase(c){editor(c?'Case details':'New case',`<label>Name<input name="name" required value="${esc(c?.name||'')}"></label><label>Case description<textarea name="notes" rows="14">${esc(c?.notes||'')}</textarea></label>`,async d=>{caseId=await rpc('case_save',{p_company:companyId,p_case:c?.id||null,p_name:d.get('name'),p_notes:d.get('notes')});});}
function editScenario(c,s){editor(s?'Scenario details':'New scenario',`<label>Name<input name="name" required value="${esc(s?.name||'')}"></label><label>Status<select name="status">${statusOptions(s?.status||'Proposal')}</select></label><label>Scenario description<textarea name="description" rows="14">${esc(s?.description||'')}</textarea></label>`,async d=>{await rpc('scenario_details_save',{p_company:companyId,p_case:c.id,p_scenario:s?.id||null,p_name:d.get('name'),p_status:d.get('status'),p_description:d.get('description')});});}
function copyScenario(c,s){editor('Copy scenario',`<label>Name<input name="name" required value="${esc(s.name+' - copy')}"></label><label>Copy as<select name="kind"><option value="alternative">Scenario</option><option value="reference">Reference batch</option></select></label>`,async d=>{await rpc('copy_batch',{p_company:companyId,p_batch:s.batch_id,p_name:d.get('name'),p_reference:d.get('kind')==='reference'});});}
$('editor-form').onsubmit=e=>{e.preventDefault();task(async()=>{await saveEditor(new FormData(e.target));$('editor').close();await refresh()})};$('close-editor').onclick=$('cancel-editor').onclick=()=>$('editor').close();
if(auth)start().catch(e=>{sessionStorage.setItem('ekwo-login-error',e.message);logout();});else location.replace('sign-in.html');
