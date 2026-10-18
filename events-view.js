import {displayEntryDate,summaryEntry} from './format.js?v=compact-dates-v1';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function minorUnits(value){
  const match=String(value??0).match(/^(-?)(\d+)(?:\.(\d{1,2})0*)?$/);
  if(!match)throw Error('Unsupported monetary amount');
  return (match[1]?-1n:1n)*(BigInt(match[2])*100n+BigInt((match[3]||'').padEnd(2,'0')));
}
export function money(value){
  const negative=value<0n,absolute=negative?-value:value;
  return (negative?'-':'')+(absolute/100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+(absolute%100n).toString().padStart(2,'0');
}
const compare=(a,b)=>String(a??'').localeCompare(String(b??''),'en',{numeric:true});
export function prepareEvents(entries){
  const journals=entries.map(e=>String(e.reference||'').startsWith('SUM:')?summaryEntry(e):e).sort((a,b)=>compare(a.entry_date,b.entry_date)||compare(a.id,b.id));
  const accounts=new Map();let debit=0n,credit=0n;
  for(const entry of journals){
    entry.lines=[...(entry.lines||[])].sort((a,b)=>Number(a.sequence)-Number(b.sequence));
    for(const line of entry.lines){
      const dr=minorUnits(line.debit),cr=minorUnits(line.credit);
      debit+=dr;credit+=cr;
      const key=line.account_id;
      if(!accounts.has(key))accounts.set(key,{id:key,code:line.account_code,name:line.account_name,debits:[],credits:[],debit:0n,credit:0n});
      const account=accounts.get(key),event={entry,line};
      if(dr!==0n)account.debits.push({...event,amount:dr});
      if(cr!==0n)account.credits.push({...event,amount:cr});
      account.debit+=dr;account.credit+=cr;
    }
  }
  return {journals,accounts:[...accounts.values()].sort((a,b)=>compare(a.code,b.code)||compare(a.id,b.id)),debit,credit};
}
function amountCell(value){return `<td class="event-number">${value===0n?'':money(value)}</td>`;}
export function journalMarkup(model){
  return model.journals.map(entry=>{
    let debit=0n,credit=0n;
    const rows=entry.lines.map(line=>{const dr=minorUnits(line.debit),cr=minorUnits(line.credit);debit+=dr;credit+=cr;return `<tr><td>${esc(line.account_code)}</td><td>${esc(line.account_name)}</td><td>${esc(line.name||line.description)}</td>${amountCell(dr)}${amountCell(cr)}</tr>`;}).join('');
    return `<details class="event-journal"><summary><span>${esc(displayEntryDate(entry))} · ${esc(entry.description)}${entry.reference?` <small>${esc(entry.reference)}</small>`:''}</span><span class="event-number">${money(debit)}</span></summary>${entry.state==='posted'?'<header><span class="state">Actual</span></header>':''}<div class="event-scroll"><table><thead><tr><th>Account</th><th>Name</th><th>Description</th><th class="event-number">Debit</th><th class="event-number">Credit</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="3">Total</th>${amountCell(debit)}${amountCell(credit)}</tr></tfoot></table></div></details>`;
  }).join('');
}
export function transactionTooltip(entry,line){
 return [...new Set([entry.description,line?.name||line?.description].filter(Boolean))].join(' · ');
}
function side(events,total,carried=0n){return `<div class="t-side">${events.map(({entry,line,amount})=>`<div class="t-line"><span class="t-description" title="${esc(transactionTooltip(entry,line))}"><span class="event-date">${esc(displayEntryDate(entry))}</span> · ${esc(entry.description)}${entry.reference?` <small>${esc(entry.reference)}</small>`:''}</span><span class="event-number">${money(amount)}</span></div>`).join('')}${carried?`<div class="t-carry"><span>Balance c/f</span><span class="event-number">${money(carried)}</span></div>`:''}<div class="t-total"><span>Total</span><span class="event-number">${money(total)}</span></div></div>`;}
export function accountsMarkup(model){
  return model.accounts.map(account=>{
    const total=account.debit>account.credit?account.debit:account.credit;
    return `<article class="t-account"><h2 title="${esc(account.name)}">${esc(account.code)} · ${esc(account.name)}</h2><div class="t-head"><span>Debit</span><span>Credit</span></div><div class="t-sides">${side(account.debits,total,total-account.debit)}${side(account.credits,total,total-account.credit)}</div></article>`;
  }).join('');
}
export function eventsMarkup(entries,mode,currency){
  const model=prepareEvents(entries);
  return `<section class="events-scope" aria-label="Scenario events"><div class="events-summary"><span>${model.journals.length} entries · ${esc(currency)}</span><span>Debit ${money(model.debit)} · Credit ${money(model.credit)}</span></div>${model.journals.length?(mode==='accounts'?accountsMarkup(model):mode==='chart'?chartMarkup(model):journalMarkup(model)):'<p class="empty">No events in this scenario.</p>'}</section>`;
}

const signed=n=>(n>=0n?'+':'')+money(n);
export function chartMarkup(model){
 const rows=model.accounts.map(a=>{
  let balance=0n;const lines=model.journals.flatMap(e=>e.lines.filter(l=>l.account_id===a.id).map(l=>{const dr=minorUnits(l.debit),cr=minorUnits(l.credit);balance+=dr-cr;return '<tr><td>'+esc(displayEntryDate(e))+'</td><td title="'+esc(transactionTooltip(e,l))+'">'+esc(e.description)+'</td><td class="event-number">'+(dr?signed(dr):'')+'</td><td class="event-number">'+(cr?signed(-cr):'')+'</td><td class="event-number">'+signed(balance)+'</td></tr>';})).join('');
  return '<tr><td>'+esc(a.code)+'</td><td><button class="text-button" data-account-open="'+esc(a.id)+'" aria-expanded="false" title="'+esc(a.name)+'">'+esc(a.name)+'</button></td><td></td><td class="event-number">'+signed(a.debit)+'</td><td class="event-number">'+signed(-a.credit)+'</td><td class="event-number">'+signed(a.debit-a.credit)+'</td></tr><tr data-account-detail="'+esc(a.id)+'" hidden><td colspan="6"><table><thead><tr><th>Date</th><th>Description</th><th class="event-number">Debit Δ</th><th class="event-number">Credit Δ</th><th class="event-number">Balance Δ</th></tr></thead><tbody>'+lines+'</tbody></table></td></tr>';
 }).join('');
 return '<div class="event-scroll"><table class="event-accounts"><thead><tr><th>Code</th><th>Account</th><th class="event-number">Brought forward</th><th class="event-number">Debit Δ</th><th class="event-number">Credit Δ</th><th class="event-number" title="Change from an imputed zero, not the company balance">Closing balance Δ</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
