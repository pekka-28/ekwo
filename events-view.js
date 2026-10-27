// events-view.js
import {displayEntryDate} from './format.js?v=database-presentation-v1';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function minorUnits(value,decimals=2){
  const match=String(value??0).match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if(!match||!Number.isInteger(decimals)||decimals<0||decimals>20)throw Error('Unsupported monetary amount or currency precision');
  const fraction=match[3]||'';
  if(/[^0]/.test(fraction.slice(decimals)))throw Error('Amount exceeds currency precision');
  return (match[1]?-1n:1n)*(BigInt(match[2])*10n**BigInt(decimals)+BigInt(fraction.slice(0,decimals).padEnd(decimals,'0')||'0'));
}
export function money(value,decimals=2){
  const negative=value<0n,absolute=negative?-value:value,scale=10n**BigInt(decimals);
  return (negative?'-':'')+(absolute/scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',')+(decimals?'.'+(absolute%scale).toString().padStart(decimals,'0'):'');
}
export function prepareEvents(data){
  if(data?.contract!=='events-v1')throw Error('Unsupported Events data; reload the application.');
  return {...data,debit:minorUnits(data.debit),credit:minorUnits(data.credit),accounts:data.accounts.map(a=>({
    ...a,...Object.fromEntries(['debit','credit','total','debitCarry','creditCarry','change'].map(k=>[k,minorUnits(a[k])])),
    debits:a.debits.map(e=>({...e,amount:minorUnits(e.amount)})),credits:a.credits.map(e=>({...e,amount:minorUnits(e.amount)})),
    movements:a.movements.map(e=>({...e,debit:minorUnits(e.debit),credit:minorUnits(e.credit),balance:minorUnits(e.balance)}))
  }))};
}
function amountCell(value){return `<td class="event-number">${value===0n?'':money(value)}</td>`;}
export function journalMarkup(model){
  return model.journals.map(entry=>{
    const debit=minorUnits(entry.display_debit),credit=minorUnits(entry.display_credit);
    const rows=entry.lines.map(line=>{const dr=minorUnits(line.debit),cr=minorUnits(line.credit);return `<tr><td>${esc(line.account_code)}</td><td>${esc(line.account_name)}</td><td>${esc(line.name||line.description)}</td>${amountCell(dr)}${amountCell(cr)}</tr>`;}).join('');
    return `<details class="event-journal"><summary><span>${esc(displayEntryDate(entry))} · ${esc(entry.description)}${entry.reference?` <small>${esc(entry.reference)}</small>`:''}</span><span class="event-number">${money(debit)}</span></summary>${entry.state==='posted'?'<header><span class="state">Actual</span></header>':''}<div class="event-scroll"><table><thead><tr><th>Account</th><th>Name</th><th>Description</th><th class="event-number">Debit</th><th class="event-number">Credit</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="3">Total</th>${amountCell(debit)}${amountCell(credit)}</tr></tfoot></table></div></details>`;
  }).join('');
}
export function transactionTooltip(entry,line){
 return [...new Set([entry.description,line?.name||line?.description].filter(Boolean))].join(' · ');
}
function side(events,total,carried=0n){return `<div class="t-side">${events.map(({entry,line,amount})=>`<div class="t-line"><span class="t-description" title="${esc(transactionTooltip(entry,line))}"><span class="event-date">${esc(displayEntryDate(entry))}</span> · ${esc(entry.description)}${entry.reference?` <small>${esc(entry.reference)}</small>`:''}</span><span class="event-number">${money(amount)}</span></div>`).join('')}${carried?`<div class="t-carry"><span>Balance c/f</span><span class="event-number">${money(carried)}</span></div>`:''}<div class="t-total"><span>Total</span><span class="event-number">${money(total)}</span></div></div>`;}
export function accountsMarkup(model){
  return model.accounts.map(account=>{
    return `<article class="t-account"><h2 title="${esc(account.name)}">${esc(account.code)} · ${esc(account.name)}</h2><div class="t-head"><span>Debit</span><span>Credit</span></div><div class="t-sides">${side(account.debits,account.total,account.debitCarry)}${side(account.credits,account.total,account.creditCarry)}</div></article>`;
  }).join('');
}
export function eventsMarkup(entries,mode,currency){
  const model=prepareEvents(entries);
  return `<section class="events-scope" aria-label="Scenario events"><div class="events-summary"><span>${model.journals.length} entries · ${esc(currency)}</span><span>Debit ${money(model.debit)} · Credit ${money(model.credit)}</span></div>${model.journals.length?(mode==='accounts'?accountsMarkup(model):mode==='chart'?chartMarkup(model):journalMarkup(model)):'<p class="empty">No events in this scenario.</p>'}</section>`;
}

const signed=n=>(n>=0n?'+':'')+money(n);
export function chartMarkup(model){
 const rows=model.accounts.map(a=>{
  const lines=a.movements.map(({entry:e,line:l,debit:dr,credit:cr,balance})=>'<tr><td>'+esc(displayEntryDate(e))+'</td><td title="'+esc(transactionTooltip(e,l))+'">'+esc(e.description)+'</td><td class="event-number">'+(dr?signed(dr):'')+'</td><td class="event-number">'+(cr?signed(-cr):'')+'</td><td class="event-number">'+signed(balance)+'</td></tr>').join('');
  return '<tr><td>'+esc(a.code)+'</td><td><button class="text-button" data-account-open="'+esc(a.id)+'" aria-expanded="false" title="'+esc(a.name)+'">'+esc(a.name)+'</button></td><td></td><td class="event-number">'+signed(a.debit)+'</td><td class="event-number">'+signed(-a.credit)+'</td><td class="event-number">'+signed(a.change)+'</td></tr><tr data-account-detail="'+esc(a.id)+'" hidden><td colspan="6"><table><thead><tr><th>Date</th><th>Description</th><th class="event-number">Debit Δ</th><th class="event-number">Credit Δ</th><th class="event-number">Balance Δ</th></tr></thead><tbody>'+lines+'</tbody></table></td></tr>';
 }).join('');
 return '<div class="event-scroll"><table class="event-accounts"><thead><tr><th>Code</th><th>Account</th><th class="event-number">Brought forward</th><th class="event-number">Debit Δ</th><th class="event-number">Credit Δ</th><th class="event-number" title="Change from an imputed zero, not the company balance">Closing balance Δ</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
