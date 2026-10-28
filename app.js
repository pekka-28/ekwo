// app.js
import {scenarioName,canReview,summaryMarkup} from './scenario-summary.js?v=database-presentation-v1';
import {displayDate} from './format.js?v=database-presentation-v1';
import {openEventEditor} from './event-editor.js';
import {nativeIcon} from './icons.js';
import {openCaseEditor} from './src/case-view.js';
import {renderCaseTimeline} from './src/case-timeline.js';
import {registerApplication,mountMenu,unmount} from './ekwo-view-runtime.js';
﻿import {config} from './config.js';
import {createDataClient} from './data-client.js';
const dataClient=createDataClient(config.url,config.publishableKey,sessionStorage);
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states=['Proposal','Reviewing','Accepted','Retired'];
let auth=null;
dataClient.auth.onAuthStateChange((event,session)=>{auth=session;if(event==='SIGNED_OUT')location.replace('sign-in.html');});
let companies=[],companyId=null,caseId=null,overview={cases:[],batches:[]},busy=false,saveEditor=null,eventReview=null,eventMode='journal',eventLevel='summary',workspaceKind='case',planningAllowed=true;
let restoringHistory=false,editorContextChanged=false;
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
async function planningRequest(request){try{return await request;}catch(error){if(error.message.startsWith('Planning is not active'))renderPlanningSession();throw error;}}
const rpc=(name,args)=>planningRequest(dataClient.rpc(name,args));
const requestReport=body=>planningRequest(dataClient.report(body));
async function task(fn){if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');notice();try{await fn()}catch(e){if($('editor').open)$('editor-error').textContent=e.message;else notice(e.message,true)}finally{busy=false;document.body.removeAttribute('aria-busy');if(pendingHistory){const view=pendingHistory;pendingHistory=null;task(()=>restoreView(view));}}}
// Shared settings are intentional. Refuse actions based on an outdated display.
function contextKey(workspace,presentation){
 return JSON.stringify({capture:workspace.active_case_id||null,
  choices:workspace.cases.map(c=>[c.id,c.selected_scenario_id||null]).sort((a,b)=>a[0].localeCompare(b[0])),
  presentation:caseId?{level:presentation?.level||'summary',transactions:presentation?.transactions||'journal'}:null});
}
async function checkPlanningContext(){
 if(!companyId||!planningAllowed)return true;
 if(editorContextChanged&&($('editor').open||$('case-editor').open))throw Error('Planning settings changed. Close and reopen this editor before saving; your text is retained here.');
 const previous=contextKey(overview,overview.cases.find(c=>c.id===caseId)?.presentation);
 const current=await rpc('workspace',{p_company:companyId});
 const presentation=caseId?await rpc('case_presentation',{p_company:companyId,p_case:caseId}):null;
 if(previous===contextKey(current,presentation))return true;
 if($('editor').open||$('case-editor').open)editorContextChanged=true;
 await refresh();
 const message='Planning settings changed in another session. The view has been refreshed; the action was not performed. Review the settings and try again.';
 if($('editor').open)$('editor-error').textContent=message+' Close and reopen this editor before saving; your text is retained here.';
 else notice(message,true);
 return false;
}
const planningTask=fn=>task(async()=>{if(await checkPlanningContext())await fn();});
async function logout(){await dataClient.auth.signOut({scope:'local'});auth=null;companyId=null;caseId=null;companies=[];overview={cases:[],batches:[]};sessionStorage.removeItem('ekwo-lustre-session');$('workspace').hidden=true;$('sign-out').hidden=true;$('content').replaceChildren();$('company-options').replaceChildren();$('side-menu').replaceChildren();$('company-name').textContent='Choose a company';$('editor').close();location.replace('sign-in.html');}
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
function sidebar(){if($('planning-menu'))unmount($('planning-menu'));const groups=[['Day to day',[['Overview','','M3 11 12 3l9 8 M5 10v11h14V10'],['Sales','sales',box],['Purchases','purchases',box],['Bank','bank','M3 9h18L12 3z M5 9v11m7-11v11m7-11v11M3 21h18'],['Contacts','contacts','M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 21v-3a8 8 0 0 1 16 0v3']]],['Accounting',[['Matching','matching',box],['Statements','statements',box],['Year end','year-end',box],['Chart of accounts','accounts',box],['Import','import',box]]],['CFO',[['Cockpit','cockpit',box],['Products','products',box]]]];
 $('side-menu').innerHTML=groups.map(([name,items])=>`<div class="nav-group">${name}</div>`+items.map(([label,path,glyph])=>['cases','forecast'].includes(path)?`<a href="#${path}" ${((workspaceKind==='forecast')===(path==='forecast'))?'class="active" aria-current="page"':''} id="${path}-nav">${path==='cases'?'<img class="nav-icon" src="poppy.svg" alt="">':'<img class="nav-icon" src="poppy-seedpod.svg" alt="">'}<span class="nav-label">${label}</span></a>`:`<a href="${nativeUrl(path)}" target="_blank" rel="noopener" ${companyId?'':'aria-disabled="true"'}>${nativeIcon({'':'layout-dashboard',sales:'file-text',purchases:'shopping-bag',bank:'landmark',contacts:'book-user',matching:'link-2',statements:'scale','year-end':'calendar-check',accounts:'book-open',import:'upload',cockpit:'compass',products:'package'}[path])}<span class="nav-label">${label}</span></a>`).join('')).join('')+`<div class="nav-group"></div><a href="${nativeUrl('settings')}" target="_blank" rel="noopener" ${companyId?'':'aria-disabled="true"'}>${nativeIcon('settings')}<span class="nav-label">Settings</span></a>`;

document.querySelectorAll('#side-menu a').forEach(a=>a.title=a.textContent.trim());
 const cfo=[...$('side-menu').querySelectorAll('.nav-group')].find(el=>el.textContent==='CFO');
 const host=document.createElement('div');host.id='planning-menu';
 $('side-menu').insertBefore(host,cfo||null);renderPlanningMenu();}
function renderPlanningMenu(){
 const host=$('planning-menu');if(!host)return;
 registerApplication({key:'planning',label:'Planning',order:25,entries:planningAllowed?
  [{key:'cases',label:'Cases',href:'#cases',icon:'poppy.svg',needs:'planning'},
   {key:'forecast',label:'Forecast',href:'#forecast',icon:'poppy-seedpod.svg',needs:'planning'}]:
  [{key:'cases',label:'Reports',href:'#cases',icon:'poppy.svg'}]});
 mountMenu(host,{application:'planning',companyId,current:'planning-'+(workspaceKind==='forecast'&&planningAllowed?'forecast':'cases'),
  capabilities:planningAllowed?['planning']:[],folded:document.documentElement.dataset.folded==='true'&&innerWidth>=768,
  onNavigate:key=>task(async()=>{workspaceKind=key==='forecast'?'forecast':'case';caseId=null;eventReview=null;sidebar();await refresh();})});
}
new MutationObserver(renderPlanningMenu).observe(document.documentElement,{attributes:true,attributeFilter:['data-folded','data-menu-open']});
window.addEventListener('resize',renderPlanningMenu);
async function start(){companies=await dataClient.companies();const stored=sessionStorage.getItem('ekwo-lustre-company:'+auth.user.id);companyId=companies.some(c=>c.id===stored)?stored:companies.length===1?companies[0].id:null;$('account-name').textContent=auth.user.email;$('workspace').hidden=false;$('sign-out').hidden=false;companyPicker();sidebar();await refresh();}
async function selectCompany(id){if(!companies.some(c=>c.id===id))return;companyId=id;caseId=null;sessionStorage.setItem('ekwo-lustre-company:'+auth.user.id,id);closeCompanies();companyPicker();sidebar();await refresh();}
function renderPlanningSession(){eventReview=null;caseId=null;overview={cases:[],batches:[]};$('breadcrumb').textContent='PLANNING';$('page-title').textContent='Planning session';$('page-actions').innerHTML=action('planning-takeover','Use planning here');$('content').innerHTML='<p>Planning is not active in this session. Taking over prevents other login sessions from using the planning ledger.</p>';$('planning-takeover').onclick=()=>task(async()=>{await rpc('planning_takeover',{});await refresh();});}
async function refresh(){if(companyId){const access=await rpc('access',{p_company:companyId});planningAllowed=access.planning;sidebar();if(planningAllowed&&!access.planning_active){renderPlanningSession();return;}if(!planningAllowed){eventReview=null;caseId=null;overview={cases:[],batches:[]};await openReportRegister();return;}}if(eventReview&&eventReview.company!==companyId)eventReview=null;if(eventReview){const snapshot=await rpc('scenario_events',{p_company:companyId,p_scenario:eventReview.scenario.id});if(canReview(snapshot))Object.assign(eventReview,snapshot);else eventReview=null;}overview=companyId?await rpc('workspace',{p_company:companyId}):{cases:[],batches:[]};if(caseId){const c=overview.cases.find(c=>c.id===caseId);if(c)c.presentation=await rpc('case_presentation',{p_company:companyId,p_case:caseId});}if(caseId&&!overview.cases.some(c=>c.id===caseId))caseId=null;render();}
function action(id,label){return `<button id="${id}">${label}</button>`;}
function render(){rememberView();notice();$('breadcrumb').textContent=workspaceKind==='forecast'?'FORECAST':'CASES';$('page-actions').innerHTML='';if(!companyId){$('page-title').textContent='Companies';$('content').innerHTML=companies.length?`<div class="company-grid">${companies.map(c=>`<button class="company-card" data-company="${c.id}"><strong>${esc(c.name)}</strong><span class="country">${flag(c.country)} ${esc(c.country)}</span></button>`).join('')}</div>`:'<p class="empty">No companies.</p>';$('content').querySelectorAll('[data-company]').forEach(b=>b.onclick=()=>task(()=>selectCompany(b.dataset.company)));return;}
 const selectedCase=overview.cases.find(c=>c.id===caseId);if(selectedCase){if(eventReview?.company===companyId&&eventReview?.case===caseId){const current=selectedCase.scenarios.find(s=>s.id===eventReview.scenario.id);if(current){eventReview.scenario=current;eventLevel=selectedCase.presentation?.level||'summary';eventMode=selectedCase.presentation?.transactions||'journal';return renderEvents(selectedCase);}eventReview=null;}return renderCase(selectedCase);}eventReview=null;
 const listedCases=overview.cases.filter(c=>(c.kind||'case')===workspaceKind);
 $('page-title').textContent=workspaceKind==='forecast'?'Forecast':'Cases';if(overview.can_write&&workspaceKind==='case'){$('page-actions').innerHTML=action('new-case','New case');$('new-case').onclick=()=>planningTask(()=>editCase());}
 $('content').innerHTML=listedCases.length?`<div class="case-table"><table><thead><tr><th>Case</th><th>Scenarios</th><th>Selected</th></tr></thead><tbody>${listedCases.map(c=>`<tr><td><button class="text-button" data-case="${c.id}">${esc(c.name)}</button></td><td>${c.scenarios?.length||0}</td><td>${esc(c.scenarios?.find(s=>s.id===c.selected_scenario_id)?.name||'')}</td></tr>`).join('')}</tbody></table></div>`:`<p class="empty">${workspaceKind==='forecast'?'No forecasts. A source budget is required.':'No cases.'}</p>`;
 if(workspaceKind==='case'){$('page-actions').insertAdjacentHTML('beforeend',action('treasury-example','Naledi Treasury example'));$('treasury-example').onclick=()=>task(treasuryExample);}
 $('content').querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>task(async()=>{caseId=b.dataset.case;await refresh()}));}
function showTimeline(data,back){
 $('page-title').textContent=data.name+' — account time series';
 $('breadcrumb').textContent='PLANNING–'+data.case_type;
 $('page-actions').innerHTML=action('back-analysis','Back');$('back-analysis').onclick=back;
 renderCaseTimeline($('content'),data);
}
async function treasuryExample(){
 const response=await fetch('./examples/naledi-treasury.json');if(!response.ok)throw Error('Treasury example unavailable');
 showTimeline(await response.json(),()=>render());
}
function statusOptions(current){return [...new Set([...states,current])].filter(Boolean).map(s=>`<option ${s===current?'selected':''}>${esc(s)}</option>`).join('');}
function renderCase(c){eventLevel=c.presentation?.level||'summary';eventMode=c.presentation?.transactions||'journal';$('page-title').textContent=c.name;$('breadcrumb').innerHTML='<a href="#cases" id="back-cases">'+(c.kind==='forecast'?'Forecast':'Cases')+'</a> / '+esc(c.name);$('page-actions').innerHTML=action('case-document','Report')+action('past-reports','Reports')+action('clear-selection','Use baseline')+(overview.can_write?action('edit-case','Case details')+(c.kind==='forecast'?'':action('new-scenario','New scenario')):'');$('clear-selection').onclick=()=>planningTask(async()=>{await rpc('select',{p_company:companyId,p_case:c.id,p_scenario:null});await refresh()});if(overview.can_write){$('edit-case').onclick=()=>planningTask(()=>editCase(c));if($('new-scenario'))$('new-scenario').onclick=()=>planningTask(()=>editScenario(c));}
 $('content').innerHTML=`<div class="case-table"><table><thead><tr><th>Scenario</th><th>Status</th><th>Selected</th><th>Entries</th><th></th></tr></thead><tbody>${(c.scenarios||[]).map(s=>`<tr><td>${scenarioName(s)}</td><td><span class="state">${esc(s.status||'Proposal')}</span></td><td><label class="selection"><input type="radio" name="scenario-selection" data-select="${s.id}" aria-label="Select ${esc(s.name)}" ${c.selected_scenario_id===s.id?'checked':''}></label></td><td><button class="text-button" data-events="${s.id}" ${canReview(s)?'':'disabled'} aria-label="Events for ${esc(s.name)}">${s.summary_entries?`${s.summary_entries}/`:""}${s.entries}</button></td><td><div class="row-actions">${overview.can_write?`<button data-edit="${s.id}" ${!s.actions?.edit?'disabled title="Reported scenario: copy to edit"':''}>Edit</button><button data-copy="${s.id}">Copy</button>`:''}<button data-events="${s.id}" ${canReview(s)?'':'disabled'}>Events</button></div></td></tr>`).join('')}</tbody></table></div>`;
 $('page-actions').insertAdjacentHTML('afterbegin',`<label class="events-switch"><select id="case-level" aria-label="Summary or detail"><option value="summary" ${eventLevel==='summary'?'selected':''}>Summary</option><option value="detail" ${eventLevel==='detail'?'selected':''}>Detail</option></select></label><label class="events-switch"><select id="case-view" aria-label="Display type"><option value="journal" ${eventMode==='journal'?'selected':''}>Journal</option><option value="accounts" ${eventMode==='accounts'?'selected':''}>T-accounts</option><option value="chart" ${eventMode==='chart'?'selected':''}>Accounts</option></select></label>`);
 $('case-level').onchange=e=>{const level=e.target.value;planningTask(()=>saveCasePresentation(c,level,eventMode));};
 $('case-view').onchange=e=>{const view=e.target.value;planningTask(()=>saveCasePresentation(c,eventLevel,view));};
 $('case-document').onclick=()=>planningTask(()=>openCaseDocument(c));$('past-reports').onclick=()=>task(()=>openReportRegister(c));
 if(overview.can_write&&c.kind!=='forecast'){$('page-actions').insertAdjacentHTML('afterbegin',action('capture-case',overview.active_case_id===c.id?'Stop capture':'Use for capture'));$('capture-case').onclick=()=>planningTask(async()=>{await rpc('capture_case',{p_company:companyId,p_case:overview.active_case_id===c.id?null:c.id});await refresh();});}
 $('page-actions').insertAdjacentHTML('beforeend',action('case-timeline','Account time series'));
 $('case-timeline').onclick=()=>planningTask(async()=>{
  const company=companyId;const data=await rpc('case_timeline',{p_company:company,p_case:c.id});
  if(companyId!==company||caseId!==c.id)return;
  showTimeline(data,()=>renderCase(c));
 });
 if(c.notes)$('content').insertAdjacentHTML('afterbegin',`<details class="case-description"><summary>Case description</summary><div class="description-text">${esc(c.notes)}</div></details>`);
 if(overview.active_case_id===c.id)$('content').insertAdjacentHTML('afterbegin','<p class="capture-state">Active case for capture</p>');
 for(const el of $('content').querySelectorAll('[data-events]'))el.onclick=()=>planningTask(()=>openEvents(c,c.scenarios.find(s=>s.id===el.dataset.events)));
 $('back-cases').onclick=e=>{e.preventDefault();caseId=null;render()};
 for(const el of $('content').querySelectorAll('[data-select]'))el.onchange=()=>planningTask(async()=>{await rpc('select',{p_company:companyId,p_case:c.id,p_scenario:el.dataset.select});await refresh()});
 for(const el of $('content').querySelectorAll('[data-edit]'))el.onclick=()=>planningTask(()=>editScenario(c,c.scenarios.find(s=>s.id===el.dataset.edit)));
 for(const el of $('content').querySelectorAll('[data-copy]'))el.onclick=()=>planningTask(()=>copyScenario(c,c.scenarios.find(s=>s.id===el.dataset.copy)));
 const refs=c.references||[];if(refs.length){const section=document.createElement('section');section.className='references';section.innerHTML='<h2>Reference batches</h2><div class="case-table"><table><thead><tr><th>Reference</th><th>Entries</th><th></th></tr></thead><tbody>'+refs.map(b=>'<tr><td>'+esc(b.name)+'</td><td>'+b.entries+'</td><td>'+(overview.can_write?'<button data-reference="'+b.id+'">Copy</button>':'')+'</td></tr>').join('')+'</tbody></table></div>';$('content').append(section);section.querySelectorAll('[data-reference]').forEach(button=>button.onclick=()=>{const b=refs.find(b=>b.id===button.dataset.reference);planningTask(()=>copyScenario(c,{name:b.name,batch_id:b.id}));});}

}
async function openEvents(c,s){
 const company=companyId;const snapshot=await rpc('scenario_events',{p_company:company,p_scenario:s.id});
 if(companyId!==company||caseId!==c.id)return;
 if(!canReview(snapshot)){eventReview=null;await refresh();notice('Events review is unavailable until this scenario reconciles.');return;}
 eventLevel=snapshot.presentation?.level||'summary';eventMode=snapshot.presentation?.transactions||'journal';eventReview={company,case:c.id,scenario:s,...snapshot};renderEvents(c);
}
function renderEvents(c){
 rememberView();
 const s=eventReview.scenario;
 $('page-title').textContent=s.name;
 $('breadcrumb').innerHTML=`<a href="#cases" id="events-cases">${c.kind==='forecast'?'Forecast':'Cases'}</a> / <a href="#case" id="events-case">${esc(c.name)}</a> / Events`;
 const capture=s.actions?.capture===true;
 $('page-actions').innerHTML=(capture?action('add-event','Add event')+action('assign-event','Assign existing event'):'');
 $('content').innerHTML=(s.description?`<details class="scenario-description"><summary>Scenario description</summary><div class="description-text">${esc(s.description)}</div></details>`:'')+summaryMarkup(eventReview,eventMode,companies.find(c=>c.id===companyId)?.currency_code||'',eventLevel);
 for(const button of $('content').querySelectorAll('[data-account-open]'))button.onclick=()=>{const row=[...$('content').querySelectorAll('[data-account-detail]')].find(r=>r.dataset.accountDetail===button.dataset.accountOpen);row.hidden=!row.hidden;button.setAttribute('aria-expanded',String(!row.hidden));};
 if(capture){$('add-event').onclick=()=>planningTask(()=>addEvent(s));$('assign-event').onclick=()=>planningTask(()=>assignEvent(s));}
 $('events-cases').onclick=e=>{e.preventDefault();eventReview=null;caseId=null;render();};
 $('events-case').onclick=e=>{e.preventDefault();eventReview=null;task(()=>refresh());};
}
async function saveCasePresentation(c,level,view){
 const expanded=$('content').querySelector('details')?.open;$('case-level').disabled=true;$('case-view').disabled=true;
 try{c.presentation=await rpc('case_presentation_save',{p_company:companyId,p_case:c.id,p_level:level,p_view:view});}
 finally{renderCase(c);const details=$('content').querySelector('details');if(details)details.open=!!expanded;}
}
async function addEvent(s){
 const company=companyId;const accounts=await dataClient.accounts(company);const rounding=await dataClient.rounding(company);
 const pendingKey='ekwo-journal-pending:'+company+':'+s.id;
 const request=sessionStorage.getItem(pendingKey)||crypto.randomUUID();
 const recovery=JSON.parse(sessionStorage.getItem('ekwo-journal-draft:'+request)||'null');
 openEventEditor({editor,accounts,decimals:rounding.decimals,entries:eventReview.entries,initial:recovery?.input,save:async data=>{
  sessionStorage.setItem(pendingKey,request);
  await planningRequest(dataClient.saveJournal(request,company,s.id,s.batch_id,data));
  eventReview.entries=await rpc('batch_entries',{p_company:company,p_batch:s.batch_id});
  sessionStorage.removeItem(pendingKey);sessionStorage.removeItem('ekwo-journal-draft:'+request);
 }});
}
function assignEvent(s){
 const company=companyId;let reviewed=null,entry=null;
 editor('Assign existing event',`<p>Destination: ${esc(s.name)}</p><label>Reference or description<input id="assignment-query" autocomplete="off"></label><button type="button" id="assignment-search">Find events</button><div id="assignment-results"></div><div id="assignment-preview"></div>`,async()=>{
  if(!reviewed||!entry)throw Error('Find an event and review its assignment first.');
  await rpc('assign_event',{p_company:company,p_scenario:s.id,p_entry:entry,p_expected_batch:reviewed.source_batch,p_expected_ids:reviewed.ids});
  eventReview.entries=await rpc('batch_entries',{p_company:company,p_batch:s.batch_id});
 });
 $('assignment-search').onclick=()=>planningTask(async()=>{
  reviewed=null;entry=null;$('assignment-preview').textContent='';
  const rows=await rpc('find_events',{p_company:company,p_query:$('assignment-query').value});
  $('assignment-results').innerHTML=rows.length?`<div class="event-scroll"><table><thead><tr><th></th><th>Date</th><th>Event</th><th>Batch</th><th>State</th></tr></thead><tbody>${rows.map(e=>`<tr><td><input type="radio" name="existing-event" data-existing="${esc(e.id)}" aria-label="Review ${esc(e.description)}"></td><td>${esc(displayDate(e.entry_date))}</td><td>${esc(e.description)}<br><small>${esc(e.reference)}</small></td><td>${esc(e.batch_name||'Unbatched')}</td><td>${esc(e.state)}</td></tr>`).join('')}</tbody></table></div>`:'<p>No matching events.</p>';
  for(const el of $('assignment-results').querySelectorAll('[data-existing]'))el.onchange=()=>planningTask(async()=>{
   reviewed=null;entry=null;$('assignment-preview').textContent='';
   const preview=await rpc('assignment_preview',{p_company:company,p_entry:el.dataset.existing});
   reviewed=preview;entry=el.dataset.existing;
   $('assignment-preview').innerHTML=`<p>${preview.ids.length} event${preview.ids.length===1?'':'s'} will move to ${esc(s.name)}:</p><ul>${preview.events.map(e=>`<li>${esc(e.date)} · ${esc(e.description)}</li>`).join('')}</ul>`;
  });
 });
}
function downloadReport(report){
 if(!report?.html)throw Error(report?.error||'Report has not completed. Retry it from Reports.');
 const url=URL.createObjectURL(new Blob([report.html],{type:'text/html;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=(report.name||'Report').replace(/[^a-z0-9 -]/gi,'').trim().slice(0,80)+'.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function openCaseDocument(c){
 const company=companyId,key='report-request:'+auth.user.id+':'+company+':'+c.id;
 const request=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,request);
 const run=await requestReport({company,case:c.id,request});
 const report=await rpc('report_get',{p_company:company,p_report:run.report_id});
 downloadReport(report);sessionStorage.removeItem(key);await refresh();
}
async function openReportRegister(c=null){
 const reports=await rpc('reports',{p_company:companyId,p_case:c?.id||null});
 $('page-title').textContent=c?c.name+' — Reports':'Reports';$('page-actions').innerHTML='';
 $('breadcrumb').innerHTML=c?'<a href="#case" id="reports-case">'+esc(c.name)+'</a> / Reports':'REPORTS';if(c)$('reports-case').onclick=e=>{e.preventDefault();renderCase(c);};
 $('content').innerHTML=reports.length?'<div class="case-table"><table><thead><tr><th>Report</th><th>Created</th><th>Selected scenario</th><th>Transactions</th><th>Presentation</th><th></th></tr></thead><tbody>'+reports.map(r=>'<tr><td>'+esc(r.name||c?.name||'Report')+'</td><td title="'+esc(r.id)+'">'+esc(displayDate(r.created_at))+' '+esc(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Africa/Johannesburg'}).format(new Date(r.created_at)))+'</td><td>'+esc(r.selected||'None')+'</td><td>'+esc(r.options.level)+'</td><td>'+esc(r.options.transactions)+'</td><td><button data-report="'+esc(r.id)+'">'+(r.complete?'Open':'Rebuild')+'</button></td></tr>').join('')+'</tbody></table></div>':'<p class="empty">No reports.</p>';
 $('content').querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>task(async()=>{
 const company=companyId;let report=await rpc('report_get',{p_company:company,p_report:b.dataset.report});
 if(!report)throw Error('Report unavailable');
 if(report.status!=='complete'){
  await requestReport({company,report:report.id});
  report=await rpc('report_get',{p_company:company,p_report:report.id});
 }
 downloadReport(report);
}));
}
function editor(title,fields,save){$('editor-form').querySelector('button[type=submit]').textContent='Save';editorContextChanged=false;$('editor-title').textContent=title;$('editor-fields').innerHTML=fields;$('editor-error').textContent='';saveEditor=save;$('editor').showModal();$('editor-fields').querySelector('input')?.focus();}
async function editCase(c){
 const company=companyId;editorContextChanged=false;
 openCaseEditor({record:c||{},save:async record=>{
  if(busy)throw Error('Another operation is in progress. Try again.');
  busy=true;document.body.setAttribute('aria-busy','true');
  try{
   if(companyId!==company||!await checkPlanningContext())throw Error('Planning settings changed. Close and reopen Case details; your text is retained.');
   caseId=await rpc('case_save_typed',{p_company:company,p_case:c?.id||null,p_name:record.name,p_notes:record.notes,p_type:record.planning_purpose});
  }finally{busy=false;document.body.removeAttribute('aria-busy');}
 },afterSave:()=>task(()=>refresh())});
}
function editScenario(c,s){editor(s?'Scenario details':'New scenario',`<label>Name<input name="name" required value="${esc(s?.name||'')}"></label><label>Status<select name="status">${s?.status==='Applied'?'<option value="Applied" selected>Applied</option>':statusOptions(s?.status||'Proposal')}</select></label><label>Scenario description<textarea name="description" rows="14">${esc(s?.description||'')}</textarea></label>`,async d=>{await rpc('scenario_details_save',{p_company:companyId,p_case:c.id,p_scenario:s?.id||null,p_name:d.get('name'),p_status:d.get('status'),p_description:d.get('description')});});}
function copyScenario(c,s){editor('Copy scenario',`<label>Name<input name="name" required value="${esc(s.name+' - copy')}"></label><label>Copy as<select name="kind"><option value="alternative">Scenario</option><option value="reference">Reference batch</option></select></label>`,async d=>{await rpc('copy_batch',{p_company:companyId,p_batch:s.batch_id,p_name:d.get('name'),p_reference:d.get('kind')==='reference'});});}
$('editor-form').onsubmit=e=>{e.preventDefault();planningTask(async()=>{await saveEditor(new FormData(e.target));$('editor').close();await refresh()})};$('close-editor').onclick=$('cancel-editor').onclick=()=>$('editor').close();
const sessionResult=await dataClient.auth.getSession();auth=sessionResult.data.session;
if(auth)start().catch(e=>{sessionStorage.setItem('ekwo-login-error',e.message);logout();});else location.replace('sign-in.html');
