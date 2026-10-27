// journal.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDataClient} from '../src/data-client.ts';
import type {JournalInput} from '../src/journal.ts';

const input:JournalInput={p_date:'2026-10-28',p_description:'Equipment',p_reference:'R1',p_source:null,
 p_lines:[{account_id:'a1',name:'Asset',debit:'10.00',credit:'0'},{account_id:'a2',name:'Bank',debit:'0',credit:'10.00'}]};
function fixture(){
 const items=new Map<string,string>();
 const storage:Storage={get length(){return items.size;},getItem:k=>items.get(k)??null,setItem:(k,v)=>{items.set(k,v);},removeItem:k=>{items.delete(k);},clear:()=>items.clear(),key:i=>[...items.keys()][i]??null};
 let header:Record<string,unknown>|null=null,lines:Record<string,unknown>[]=[],headerWrites=0,lineWrites=0;
 let failLines=false,loseHeader=false,loseLines=false,stale=false,ready=true,decimals=2;
 const paths:string[]=[];
 const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const client=createDataClient('https://example.test','public-key',storage,async(raw,init)=>{
  const url=new URL(String(raw)),path=url.pathname.split('/').at(-1)!;paths.push(path);
  if(path==='rounding_of')return response([{decimals,method:'half_up'}]);
  if(path==='lustre_native_journal_ready')return response(ready);
  if(path==='companies')return response({miscellaneous_journal_id:'j1',currency_code:'ZAR'});
  if(path==='fiscal_years')return response({id:'y1'});
  if(path==='entries'){
   if(init?.method==='POST'){
    assert.equal(new Headers(init.headers).get('x-lustre-scenario'),'s1');
    const body=JSON.parse(String(init.body));assert.equal(body.lustre_batch_id,undefined);assert.equal(body.state,'draft');
    if(stale)return response({message:'Capture destination changed'},403);
    headerWrites++;header={...body,lustre_batch_id:'b1'};
    if(loseHeader)return response({message:'Response lost after commit'},503);
    return response(null);
   }
   return response(header);
  }
  if(path==='entry_lines'){
   if(init?.method==='POST'){
    if(failLines)return response({message:'Line write refused'},403);
    lineWrites++;lines=JSON.parse(String(init.body));
    if(loseLines)return response({message:'Response lost after commit'},503);
    return response(null);
   }
   assert.ok(url.searchParams.get('select')?.includes('debit::text'));
   return response(lines);
  }
  throw Error('Unexpected endpoint '+url);
 });
 return {client,storage,paths,counts:()=>({headerWrites,lineWrites}),header:()=>header,
  decimals:(v:number)=>{decimals=v;},failLines:(v:boolean)=>{failLines=v;},loseHeader:()=>{loseHeader=true;},loseLines:()=>{loseLines=true;},stale:()=>{stale=true;},unready:()=>{ready=false;}};
}
test('native header and bulk lines use ambient attribution and never post or call bespoke creation',async()=>{
 const f=fixture();await f.client.saveJournal('request','co','s1','b1',input);
 assert.deepEqual(f.counts(),{headerWrites:1,lineWrites:1});
 assert.ok(!f.paths.includes('lustre_event_create')&&!f.paths.includes('post_entry'));
 assert.equal(f.header()?.state,'draft');f.client.auth.stopAutoRefresh();
});
test('retry after line refusal reuses the header and exact line identities',async()=>{
 const f=fixture();f.failLines(true);
 await assert.rejects(f.client.saveJournal('request','co','s1','b1',input),/retained/);
 assert.deepEqual(f.counts(),{headerWrites:1,lineWrites:0});
 f.failLines(false);await f.client.saveJournal('request','co','s1','b1',input);
 await f.client.saveJournal('request','co','s1','b1',input);
 assert.deepEqual(f.counts(),{headerWrites:1,lineWrites:1});f.client.auth.stopAutoRefresh();
});
test('lost responses after commits are reconciled without repeating mutations',async()=>{
 const f=fixture();f.loseHeader();f.loseLines();
 await f.client.saveJournal('request','co','s1','b1',input);
 assert.deepEqual(f.counts(),{headerWrites:1,lineWrites:1});f.client.auth.stopAutoRefresh();
});
test('stale capture and absent migration fail before lines; unbalanced input before requests',async()=>{
 const f=fixture();f.stale();
 await assert.rejects(f.client.saveJournal('request','co','s1','b1',input),/destination changed/);
 assert.deepEqual(f.counts(),{headerWrites:0,lineWrites:0});
 const g=fixture();g.unready();await assert.rejects(g.client.saveJournal('request','co','s1','b1',input),/not installed/);
 assert.deepEqual(g.counts(),{headerWrites:0,lineWrites:0});
 const h=fixture();await assert.rejects(h.client.saveJournal('request','co','s1','b1',{...input,p_lines:input.p_lines.slice(0,1)}),/balance/);
 assert.deepEqual(h.paths,['rounding_of']);
 for(const fixture of [f,g,h])fixture.client.auth.stopAutoRefresh();
});
test('currency precision accepts three decimal units and refuses fractional zero-decimal units',async()=>{
 const f=fixture();f.decimals(3);
 const fine={...input,p_lines:input.p_lines.map((line,i)=>({...line,debit:i?'0':'10.001',credit:i?'10.001':'0'}))};
 await f.client.saveJournal('three','co','s1','b1',fine);
 const g=fixture();g.decimals(0);
 await assert.rejects(g.client.saveJournal('zero','co','s1','b1',fine),/at most 0/);
 assert.deepEqual(g.counts(),{headerWrites:0,lineWrites:0});
 f.client.auth.stopAutoRefresh();g.client.auth.stopAutoRefresh();
});
test('changed input cannot silently overwrite a pending draft',async()=>{
 const f=fixture();f.failLines(true);await assert.rejects(f.client.saveJournal('request','co','s1','b1',input));
 await assert.rejects(f.client.saveJournal('request','co','s1','b1',{...input,p_description:'Different'}),/original values/);
 assert.deepEqual(f.counts(),{headerWrites:1,lineWrites:0});f.client.auth.stopAutoRefresh();
});
