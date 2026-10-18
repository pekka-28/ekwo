import {displayDate,displayEntryDate,summaryEntry} from './format.js?v=compact-dates-v1';
import Mustache from './vendor/mustache.mjs';
import {prepareEvents,minorUnits,money,transactionTooltip} from './events-view.js?v=compact-dates-v1';
export const reportTemplateNames=['case','journal','t-account','event','shell','wrapper-style','branding','outcome','transactions','transaction-set'];
export function impactRows(data,id){
 const chosen=data.scenarios.find(s=>s.id===id);if(!chosen)return [];
 const applied=data.scenarios.find(s=>s.id===data.case.applied_scenario_id),actual=(applied?.entries||[]).filter(e=>e.state==='posted');
 const selected=chosen.id===applied?.id?actual:chosen.entries.filter(e=>['draft','posted'].includes(e.state));
 const rows=new Map();
 for(const [field,entries] of [['baseline',actual],['chosen',selected]])for(const a of prepareEvents(entries).accounts){if(!rows.has(a.id))rows.set(a.id,{id:a.id,code:a.code,name:a.name,baseline:0n,chosen:0n});rows.get(a.id)[field]=a.debit-a.credit;}
 return [...rows.values()].map(r=>({...r,change:r.chosen-r.baseline})).sort((a,b)=>a.code.localeCompare(b.code,'en',{numeric:true}));
}
const amount=n=>n===0n?'':money(n);
const eventData=({entry,line,amount:n})=>({date:displayEntryDate(entry),description:entry.description,tooltip:transactionTooltip(entry,line),lineDescription:(line?.name||line?.description)!==entry.description?(line?.name||line?.description):null,reference:entry.reference||entry.id,state:entry.state,amount:n===undefined?'':money(n)});
function transactionData(entries,name,table){
 const prepared=prepareEvents(entries),journals=prepared.journals.map(entry=>({
  ...eventData({entry}),lines:entry.lines.map((l,i)=>({code:l.account_code,name:l.account_name,description:l.name||l.description,debit:amount(minorUnits(l.debit)),credit:amount(minorUnits(l.credit)),eventDate:i===0?displayEntryDate(entry):'',eventDescription:i===0?entry.description:'',eventReference:i===0?(entry.reference||''):''}))
 }));
 const accounts=prepared.accounts.map(a=>{let balance=0n;const movements=prepared.journals.flatMap(entry=>entry.lines.filter(l=>l.account_id===a.id).map(line=>{const dr=minorUnits(line.debit),cr=minorUnits(line.credit);balance+=dr-cr;return {...eventData({entry,line}),debit:amount(dr),credit:amount(cr),balance:(balance>=0n?'+':'')+money(balance)};}));return {movements,code:a.code,name:a.name,debits:a.debits.map(eventData),credits:a.credits.map(eventData),debit:money(a.debit>a.credit?a.debit:a.credit),credit:money(a.debit>a.credit?a.debit:a.credit),debitCarry:a.credit>a.debit?money(a.credit-a.debit):'',creditCarry:a.debit>a.credit?money(a.debit-a.credit):'',debitMovement:money(a.debit),creditMovement:money(a.credit),change:(a.debit-a.credit>=0n?'+':'')+money(a.debit-a.credit)};});
 return {name,table,entries:journals,accounts,debit:money(prepared.debit),credit:money(prepared.credit),empty:!journals.length};
}
export function reportModel(data){
 const options=data.report_options||JSON.parse(data.templates.options||'{"transactions":"none"}'),mode=options.transactions,level=options.level||(options.details?'detail':'summary');
 if(!['none','journal','accounts','chart'].includes(mode)||!['summary','detail'].includes(level))throw Error('Unknown report presentation');
 const selected=data.scenarios.find(s=>s.id===data.case.selected_scenario_id),alternatives=data.scenarios.filter(s=>s.id!==data.case.applied_scenario_id);
 let table=1;
 const outcome=s=>{const rows=impactRows(data,s.id).filter(r=>r.change!==0n);return {name:s.name,description:s.description,status:s.status,isSelected:s.id===selected?.id,table:++table,empty:!rows.length,health:s.health?.status||'Unchecked',rows:rows.map(r=>({code:r.code,name:r.name,debit:r.change>0n?money(r.change):'',credit:r.change<0n?money(-r.change):''}))};};
 const summary=selected&&mode==='none'?outcome(selected):undefined;
 const transactionTable=selected&&mode!=='none'&&mode!=='accounts'?++table:null;
 const model={company:data.company.legal_name||data.company.name,title:data.case.name,currency:data.company.currency_code,
 branding:{logo:/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(data.company.report_logo_data||'')?data.company.report_logo_data:null,position:data.company.invoice_logo_position==='right'?'right':'left',accent:/^#[0-9a-f]{6}$/i.test(data.company.invoice_accent_color||'')?data.company.invoice_accent_color:null},
 date:new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Johannesburg'}).format(new Date(data.generated_at)),
 justification:data.case.notes||'No case justification recorded.',alternativesTable:1,alternatives:alternatives.map(s=>({name:s.name,status:s.status,entryCount:(s.summary_entries?.length?s.summary_entries.length+'/':'')+s.entries.length})),
 hasSelected:!!selected,summary,outcomes:alternatives.filter(s=>s.id!==selected?.id).map(outcome),scenarios:[],reportId:data.report_id,level,mode,
 showSummary:level==='summary',showDetail:level==='detail',showJournal:mode==='journal',showTAccounts:mode==='accounts',showAccounts:mode==='chart',showTransactions:mode!=='none',
 tables:transactionTable?[{number:transactionTable,name:selected.name}]:[],fragments:selected&&mode==='accounts'?[{number:1,name:selected.name}]:[]};
 if(selected)model.scenarios.push({name:selected.name,status:selected.status,table:transactionTable,fragment:mode==='accounts'?1:null,description:selected.description||'No scenario description recorded.',health:selected.health?.status||'Unchecked',findings:(selected.health?.issues||[]).map(i=>({text:i.message||i.code.replaceAll('_',' '),entry:i.entry_id})),
 summaryTransactions:transactionData(selected.summary_entries?.length?selected.summary_entries.map(summaryEntry):selected.entries,selected.name,transactionTable),
 detailTransactions:transactionData(selected.entries,selected.name,transactionTable)});
 model.context=(data.projection_context||[]).map(x=>({name:x.case.name,scenario:x.scenario.name,selected:x.selected?'Selected':'Calculation assumption (not selected)',budget:x.budget?.name||x.budget?.code||x.scenario.source_budget_id,start:displayDate(x.scenario.forecast_start),end:displayDate(x.scenario.forecast_end),cutoff:displayDate(x.scenario.forecast_actual_through),hash:x.scenario.forecast_source_hash}));
 model.contextMissing=!model.context.length;
 return model;
}
export function caseDocumentMarkup(data){return Mustache.render(data.templates.case,reportModel(data),data.templates);}
export function documentHtml(data,css){
 for(const name of reportTemplateNames)if(typeof data.templates?.[name]!=='string')throw Error('Missing report template: '+name);
 return Mustache.render(data.templates.shell,{title:data.case.name,css:css.replaceAll('</style','<\\/style'),body:caseDocumentMarkup(data)},data.templates);
}
