import {eventsMarkup} from './events-view.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function healthMarkup(health){
 const status=health?.status||'Unchecked';
 return `<span class="scenario-health" data-health="${esc(status)}">${esc(status)}</span>`;
}
export function summaryMarkup(snapshot,mode,currency){
 const summaries=snapshot.summary_entries||[],entries=snapshot.entries||[],members=snapshot.members||[];
 const assigned=new Set(members.map(m=>m.detail_entry_id));
 const issues=snapshot.health?.issues||[];
 let html=`<div class="health-result">${healthMarkup(snapshot.health)}${issues.length?`<details><summary>${issues.length} reconciliation findings</summary><ul>${issues.map(i=>`<li>${esc(i.message||i.code.replaceAll('_',' '))}${i.entry_id?` · <code>${esc(i.entry_id)}</code>`:''}${i.account_id?` · Account <code>${esc(i.account_id)}</code>; debit ${esc(i.summary_debit)} / ${esc(i.detail_debit)}, credit ${esc(i.summary_credit)} / ${esc(i.detail_credit)}`:''}</li>`).join('')}</ul></details>`:''}</div>`;
 if(summaries.length){
  html+=`<section aria-label="Scenario summary"><h2>Summary</h2>${eventsMarkup(summaries,mode,currency)}</section>`;
  html+=summaries.map(s=>{const ids=new Set(members.filter(m=>m.summary_entry_id===s.id).map(m=>m.detail_entry_id)),detail=entries.filter(e=>ids.has(e.id));return `<details class="summary-detail"><summary>${esc(s.description)} · Details (${detail.length})</summary>${eventsMarkup(detail,mode,currency)}</details>`;}).join('');
 }
 const unlinked=entries.filter(e=>!assigned.has(e.id));
 if(unlinked.length)html+=`<details class="summary-detail" open><summary>Unlinked details (${unlinked.length})</summary>${eventsMarkup(unlinked,mode,currency)}</details>`;
 if(!summaries.length&&!entries.length)html+='<p class="empty">No events in this scenario.</p>';
 return html;
}
