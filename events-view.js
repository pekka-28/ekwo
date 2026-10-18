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
function details(entry,line){return `<span class="event-date">${esc(entry.entry_date)}</span><span>${esc(entry.description)}${line?.description?`<br>${esc(line.description)}`:''}</span><small>${esc(entry.reference||entry.id)} · ${esc(entry.state)}</small>`;}
function amountCell(value){return `<td class="event-number">${value===0n?'':money(value)}</td>`;}
export function journalMarkup(model){
  return model.journals.map(entry=>{
    let debit=0n,credit=0n;
    const rows=entry.lines.map(line=>{const dr=minorUnits(line.debit),cr=minorUnits(line.credit);debit+=dr;credit+=cr;return `<tr><td>${esc(line.account_code)}</td><td>${esc(line.account_name)}</td><td>${esc(line.description)}</td>${amountCell(dr)}${amountCell(cr)}</tr>`;}).join('');
    return `<article class="event-journal"><header>${details(entry)}</header><div class="event-scroll"><table><thead><tr><th>Account</th><th>Name</th><th>Description</th><th class="event-number">Debit</th><th class="event-number">Credit</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="3">Total</th>${amountCell(debit)}${amountCell(credit)}</tr></tfoot></table></div></article>`;
  }).join('');
}
function side(events,total){return `<div class="t-side">${events.map(({entry,line,amount})=>`<div class="t-line"><div>${details(entry,line)}</div><span class="event-number">${money(amount)}</span></div>`).join('')}<div class="t-total"><span>Total</span><span class="event-number">${money(total)}</span></div></div>`;}
export function accountsMarkup(model){
  return model.accounts.map(account=>`<article class="t-account"><h2>${esc(account.code)} · ${esc(account.name)}</h2><div class="t-head"><span>Debit</span><span>Credit</span></div><div class="t-sides">${side(account.debits,account.debit)}${side(account.credits,account.credit)}</div><p class="t-movement">Net movement: ${money(account.debit>=account.credit?account.debit-account.credit:account.credit-account.debit)} ${account.debit>=account.credit?'Dr':'Cr'}</p></article>`).join('');
}
export function eventsMarkup(entries,mode,currency){
  const model=prepareEvents(entries);
  return `<section class="events-scope" aria-label="Scenario events"><div class="events-summary"><strong>Scenario only</strong><span>${model.journals.length} entries · ${esc(currency)}</span><span>Debit ${money(model.debit)} · Credit ${money(model.credit)}</span></div>${model.journals.length?(mode==='accounts'?accountsMarkup(model):journalMarkup(model)):'<p class="empty">No events in this scenario.</p>'}</section>`;
}
