import {eventsMarkup} from './events-view.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function healthMarkup(health){
 const status=health?.status||'Unchecked';
 return `<span class="scenario-health" data-health="${esc(status)}">${esc(status)}</span>`;
}
export function summaryMarkup(snapshot,mode,currency,level='summary'){
 const summaries=snapshot.summary_entries||[],entries=snapshot.entries||[];
 const issues=snapshot.health?.issues||[];
 let html=`<div class="health-result">${healthMarkup(snapshot.health)}${issues.length?`<details><summary>${issues.length} reconciliation findings</summary><ul>${issues.map(i=>`<li>${esc(i.message||i.code.replaceAll('_',' '))}${i.entry_id?` · <code>${esc(i.entry_id)}</code>`:''}${i.account_id?` · Account <code>${esc(i.account_id)}</code>; debit ${esc(i.summary_debit)} / ${esc(i.detail_debit)}, credit ${esc(i.summary_credit)} / ${esc(i.detail_credit)}`:''}</li>`).join('')}</ul></details>`:''}</div>`;
 const shown=level==='detail'?entries:summaries;
 html+=shown.length?eventsMarkup(shown,mode,currency):`<p class="empty">No ${level==='detail'?'detailed':'summary'} entries in this scenario.</p>`;
 return html;
}
