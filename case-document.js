import {displayDate} from './format.js';
import Mustache from './vendor/mustache.mjs';
import {prepareEvents,minorUnits,money} from './events-view.js';
export const reportTemplateNames=['case','journal','t-account','event','shell','wrapper-style'];
export function impactRows(data,id){
 const chosen=data.scenarios.find(s=>s.id===id);if(!chosen)return [];
 const applied=data.scenarios.find(s=>s.id===data.case.applied_scenario_id),actual=(applied?.entries||[]).filter(e=>e.state==='posted');
 const selected=chosen.id===applied?.id?actual:chosen.entries.filter(e=>['draft','posted'].includes(e.state));
 const rows=new Map();
 for(const [field,entries] of [['baseline',actual],['chosen',selected]])for(const a of prepareEvents(entries).accounts){if(!rows.has(a.id))rows.set(a.id,{id:a.id,code:a.code,name:a.name,baseline:0n,chosen:0n});rows.get(a.id)[field]=a.debit-a.credit;}
 return [...rows.values()].map(r=>({...r,change:r.chosen-r.baseline})).sort((a,b)=>a.code.localeCompare(b.code,'en',{numeric:true}));
}
const amount=n=>n===0n?'':money(n);
const eventData=({entry,line,amount:n})=>({date:displayDate(entry.entry_date),description:entry.description,lineDescription:line?.name||line?.description,reference:entry.reference||entry.id,state:entry.state,amount:n===undefined?'':money(n)});
export function reportModel(data){
 const options=JSON.parse(data.templates.options||'{"transactions":"none"}'),mode=options.transactions;
 if(!['none','journal','accounts'].includes(mode))throw Error('Unknown report transaction presentation');
 let table=1,figure=0;
 const model={company:data.company.legal_name||data.company.name,title:data.case.name,currency:data.company.currency_code,
 date:new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Johannesburg'}).format(new Date(data.generated_at)),
 justification:data.case.notes||'No case justification recorded.',alternativesTable:table,alternatives:data.scenarios.map(s=>({name:s.name,status:s.status,entryCount:s.entries.length})),scenarios:[]};
 for(const s of data.scenarios){
  const prepared=prepareEvents(s.summary_entries??s.entries),section={health:s.health?.status||'Unchecked',findings:(s.health?.issues||[]).map(i=>({text:i.message||i.code.replaceAll('_',' '),entry:i.entry_id})),name:s.name,description:s.description||'No scenario description recorded.',empty:mode!=='none'&&!s.entries.length,journals:[],accounts:[],detailJournals:[]};
  if(mode==='journal')for(const entry of prepared.journals){let debit=0n,credit=0n;const lines=entry.lines.map(l=>{const dr=minorUnits(l.debit),cr=minorUnits(l.credit);debit+=dr;credit+=cr;return {code:l.account_code,name:l.account_name,description:l.name||l.description,debit:amount(dr),credit:amount(cr)};});section.journals.push({...eventData({entry}),table:++table,lines,debit:amount(debit),credit:amount(credit)});}
  if(mode==='accounts')for(const a of prepared.accounts)section.accounts.push({figure:++figure,code:a.code,name:a.name,debits:a.debits.map(eventData),credits:a.credits.map(eventData),debit:money(a.debit>a.credit?a.debit:a.credit),credit:money(a.debit>a.credit?a.debit:a.credit),debitCarry:a.credit>a.debit?money(a.credit-a.debit):'',creditCarry:a.debit>a.credit?money(a.debit-a.credit):''});
  if(options.details&&mode!=='none')for(const entry of prepareEvents(s.entries).journals){let debit=0n,credit=0n;const lines=entry.lines.map(l=>{const dr=minorUnits(l.debit),cr=minorUnits(l.credit);debit+=dr;credit+=cr;return {code:l.account_code,name:l.account_name,description:l.name||l.description,debit:amount(dr),credit:amount(cr)};});section.detailJournals.push({...eventData({entry}),table:++table,lines,debit:amount(debit),credit:amount(credit)});}
  model.scenarios.push(section);
 }
 const selected=data.scenarios.find(s=>s.id===data.case.selected_scenario_id);
 if(selected){const rows=impactRows(data,selected.id);model.summary={name:selected.name,status:selected.status,table:++table,empty:!rows.length,rows:rows.map(r=>({code:r.code,name:r.name,baseline:money(r.baseline),chosen:money(r.chosen),change:money(r.change)}))};}
 return model;
}
export function caseDocumentMarkup(data){return Mustache.render(data.templates.case,reportModel(data),data.templates);}
export function documentHtml(data,css){
 for(const name of reportTemplateNames)if(typeof data.templates?.[name]!=='string')throw Error('Missing report template: '+name);
 return Mustache.render(data.templates.shell,{title:data.case.name,css:css.replaceAll('</style','<\\/style'),body:caseDocumentMarkup(data)},data.templates);
}
