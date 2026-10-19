import {eventsMarkup} from './events-view.js?v=database-presentation-v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function healthMarkup(health){
 const status=health?.status||'Unchecked';
 return `<span class="scenario-health" data-health="${esc(status)}">${esc(status)}</span>`;
}
export const canReview=value=>value?.can_review===true||value?.actions?.review===true;
export function scenarioName(s){
 if(canReview(s))return esc(s.name);
 const status=s.health?.status||'Unchecked';
 const explanation=s.health_description||'Reconciliation has not passed.';
 const findings=(s.health?.issues||[]).map(i=>i.message||i.code.replaceAll('_',' '));
 const tip=[status+': '+explanation,...new Set(findings),'Events review is unavailable until reconciliation passes.'].join('\n');
 return `<span class="scenario-name" data-health="${esc(status)}" title="${esc(tip)}" aria-label="${esc(s.name+': '+status)}">${esc(s.name)}</span>`;
}
export function summaryMarkup(snapshot,mode,currency,level='summary'){
 const issues=snapshot.health?.issues||[];
 let html=canReview(snapshot)?'':`<div class="health-result">${healthMarkup(snapshot.health)}${issues.length?`<details><summary>${issues.length} reconciliation findings</summary><ul>${issues.map(i=>`<li>${esc(i.message||i.code.replaceAll('_',' '))}</li>`).join('')}</ul></details>`:''}</div>`;
 const shown=snapshot.event_models?.[level];
 html+=shown?.journals.length?eventsMarkup(shown,mode,currency):`<p class="empty">No ${level==='detail'?'detailed':'summary'} entries in this scenario.</p>`;
 return html;
}
