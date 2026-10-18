import {eventsMarkup} from './events-view.js?v=compact-dates-v1';
import {summaryEntry} from './format.js?v=compact-dates-v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function healthMarkup(health){
 const status=health?.status||'Unchecked';
 return `<span class="scenario-health" data-health="${esc(status)}">${esc(status)}</span>`;
}
export const canReview=health=>health?.status==='Consistent';
export function scenarioName(s){
 if(canReview(s.health))return esc(s.name);
 const status=s.health?.status||'Unchecked';
 const explanation={Incomplete:'Summary or detail is missing or unlinked.',Inconsistent:'Summary and detail disagree in amounts, dates or structure.',Unchecked:'Reconciliation has not completed.'}[status]||'Reconciliation has not passed.';
 const findings=(s.health?.issues||[]).map(i=>i.message||i.code.replaceAll('_',' '));
 const tip=[status+': '+explanation,...new Set(findings),'Events review is unavailable until reconciliation passes.'].join('\n');
 return `<span class="scenario-name" data-health="${esc(status)}" title="${esc(tip)}" aria-label="${esc(s.name+': '+status)}">${esc(s.name)}</span>`;
}
export function summaryMarkup(snapshot,mode,currency,level='summary'){
 const summaries=snapshot.summary_entries||[],entries=snapshot.entries||[];
 const issues=snapshot.health?.issues||[];
 let html=canReview(snapshot.health)?'':`<div class="health-result">${healthMarkup(snapshot.health)}${issues.length?`<details><summary>${issues.length} reconciliation findings</summary><ul>${issues.map(i=>`<li>${esc(i.message||i.code.replaceAll('_',' '))}${i.entry_id?` · <code>${esc(i.entry_id)}</code>`:''}${i.account_id?` · Account <code>${esc(i.account_id)}</code>; debit ${esc(i.summary_debit)} / ${esc(i.detail_debit)}, credit ${esc(i.summary_credit)} / ${esc(i.detail_credit)}`:''}</li>`).join('')}</ul></details>`:''}</div>`;
 const shown=level==='detail'?entries:summaries.map(summaryEntry);
 html+=shown.length?eventsMarkup(shown,mode,currency):`<p class="empty">No ${level==='detail'?'detailed':'summary'} entries in this scenario.</p>`;
 return html;
}
