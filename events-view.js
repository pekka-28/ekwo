import {displayEntryDate} from './format.js';
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
  const journals=[...entries].sort((a,b)=>compare(a.entry_date,b.entry_date)||compare(a.id,b.id));
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
    return `<details class="event-journal"><summary><span>${esc(displayEntryDate(entry))} · ${esc(entry.description)}${entry.reference?` <small>${esc(entry.reference)}</small>`:''}</span><span class="event-number">${money(debit)}</span></summary><header><span class="state">${esc(entry.state)}</span></header><div class="event-scroll"><table><thead><tr><th>Account</th><th>Name</th><th>Description</th><th class="event-number">Debit</th><th class="event-number">Credit</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="3">Total</th>${amountCell(debit)}${amountCell(credit)}</tr></tfoot></table></div></details>`;
  }).join('');
}
export function transactionTooltip(entry,line){
 const header=[displayEntryDate(entry),entry.description,entry.reference||entry.id,entry.state].filter(Boolean).join(' · ');
 const lines=(line?[line]:[]).map(l=>{
  const description=l.name||l.description;
  return [l.account_code,l.account_name,description&&description!==entry.description?description:null,minorUnits(l.debit)!==0n?money(minorUnits(l.debit))+' Dr':null,minorUnits(l.credit)!==0n?money(minorUnits(l.credit))+' Cr':null].filter(Boolean).join(' · ');
 });
 return [header,...lines].join('\n');
}
function side(events,total,carried=0n){return `<div class="t-side">${events.map(({entry,line,amount})=>`<div class="t-line" title="${esc(transactionTooltip(entry,line))}"><span><span class="event-date">${esc(displayEntryDate(entry))}</span> · ${esc(entry.description)}${entry.reference?` <small>${esc(entry.reference)}</small>`:''}</span><span class="event-number">${money(amount)}</span></div>`).join('')}${carried?`<div class="t-carry"><span>Balance c/f</span><span class="event-number">${money(carried)}</span></div>`:''}<div class="t-total"><span>Total</span><span class="event-number">${money(total)}</span></div></div>`;}
export function accountsMarkup(model){
  return model.accounts.map(account=>{
    const total=account.debit>account.credit?account.debit:account.credit;
    return `<article class="t-account"><h2>${esc(account.code)} · ${esc(account.name)}</h2><div class="t-head"><span>Debit</span><span>Credit</span></div><div class="t-sides">${side(account.debits,total,total-account.debit)}${side(account.credits,total,total-account.credit)}</div></article>`;
  }).join('');
}
export function eventsMarkup(entries,mode,currency){
  const model=prepareEvents(entries);
  return `<section class="events-scope" aria-label="Scenario events"><div class="events-summary"><span>${model.journals.length} entries · ${esc(currency)}</span><span>Debit ${money(model.debit)} · Credit ${money(model.credit)}</span></div>${model.journals.length?(mode==='accounts'?accountsMarkup(model):journalMarkup(model)):'<p class="empty">No events in this scenario.</p>'}</section>`;
}
