// data-client.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDataClient} from '../src/data-client.ts';

function memoryStorage(): Storage {
  const items=new Map<string,string>();
  return {get length(){return items.size;},clear:()=>items.clear(),getItem:k=>items.get(k)??null,
    key:i=>[...items.keys()][i]??null,removeItem:k=>{items.delete(k);},setItem:(k,v)=>{items.set(k,v);}};
}
test('SDK scopes reads, sends RPC arguments, and preserves database refusal',async()=>{
  const requests:{url:URL;init:RequestInit}[]=[];
  const fetcher:typeof fetch=async(input,init)=>{
    const url=new URL(String(input));if(url.pathname.endsWith('ekwo_schema_version'))return new Response('"0.24.0"',{headers:{'Content-Type':'application/json'}});requests.push({url,init:init??{}});
    if(url.pathname.endsWith('lustre_denied'))return new Response(JSON.stringify({message:'Planning is not active in this session',code:'42501'}),{status:403,headers:{'Content-Type':'application/json'}});
    return new Response('[]',{headers:{'Content-Type':'application/json'}});
  };
  const client=createDataClient('https://example.test','public-key',memoryStorage(),fetcher);
  await client.companies();await client.accounts('company-123');await client.rpc('workspace',{p_company:'company-123'});
  assert.equal(requests[0]?.url.searchParams.get('order'),'name.asc');
  assert.equal(requests[1]?.url.searchParams.get('company_id'),'eq.company-123');
  assert.equal(requests[2]?.url.pathname,'/rest/v1/rpc/lustre_workspace');
  assert.deepEqual(JSON.parse(String(requests[2]?.init.body)),{p_company:'company-123'});
  assert.equal(new Headers(requests[0]?.init.headers).get('Accept-Profile'),'ekwo');
  assert.equal(new Headers(requests[2]?.init.headers).get('Content-Profile'),'public');
  await assert.rejects(client.rpc('denied'),/Planning is not active/);
  client.auth.stopAutoRefresh();
});

test('legacy schema fallback is limited to missing schema or marker, never permission refusal',async()=>{
  for(const code of ['PGRST106','PGRST202','42501']){
    const profiles:string[]=[];
    const client=createDataClient('https://example.test','public-key',memoryStorage(),async(input,init)=>{
      if(String(input).includes('ekwo_schema_version'))return new Response(JSON.stringify({code,message:'Schema probe refused'}),{status:code==='42501'?403:404,headers:{'Content-Type':'application/json'}});
      profiles.push(new Headers(init?.headers).get('Accept-Profile')??'');
      return new Response('[]',{headers:{'Content-Type':'application/json'}});
    });
    if(code==='42501'){await assert.rejects(client.companies(),/Schema probe refused/);assert.deepEqual(profiles,[]);}
    else {await client.companies();assert.deepEqual(profiles,['public']);}
    client.auth.stopAutoRefresh();
  }
});
test('SDK accepts the existing stored session and signs out locally',async()=>{
  const storage=memoryStorage();
  const token=['header',Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:'user-1',session_id:'planning-owner'})).toString('base64url'),'signature'].join('.');
  storage.setItem('ekwo-lustre-session',JSON.stringify({access_token:token,refresh_token:'refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'user-1',email:'test@example.test'}}));
  const client=createDataClient('https://example.test','public-key',storage,async()=>new Response(null,{status:204}));
  const {data,error}=await client.auth.getSession();
  assert.equal(error,null);assert.equal(data.session?.access_token,token);
  assert.equal(data.session?.user.id,'user-1');
  await client.auth.signOut({scope:'local'});
  assert.equal((await client.auth.getSession()).data.session,null);
  assert.equal(storage.getItem('ekwo-lustre-session'),null);
  client.auth.stopAutoRefresh();
});
test('report errors retain the server explanation',async()=>{
  const client=createDataClient('https://example.test','public-key',memoryStorage(),async()=>new Response(JSON.stringify({error:'Report belongs to another company'}),{status:403,headers:{'Content-Type':'application/json'}}));
  await assert.rejects(client.report({company:'wrong'}),/Report belongs to another company/);
  client.auth.stopAutoRefresh();
});

test('report transport fits deployed CORS headers without stripping authentication or payload',async()=>{
  let seen=false;
  const client=createDataClient('https://example.test','public-key',memoryStorage(),async(input,init)=>{
    assert.equal(new URL(String(input)).pathname,'/functions/v1/report-run');
    const headers=new Headers(init?.headers);
    assert.equal(headers.has('x-client-info'),false);
    assert.equal(headers.get('apikey'),'public-key');
    assert.equal(headers.get('authorization'),'Bearer public-key');
    assert.equal(headers.get('content-type'),'application/json');
    assert.deepEqual(JSON.parse(String(init?.body)),{company:'company',case:'case',request:'request'});
    seen=true;return new Response('{"report_id":"saved"}',{headers:{'Content-Type':'application/json'}});
  });
  assert.deepEqual(await client.report({company:'company',case:'case',request:'request'}),{report_id:'saved'});
  assert(seen);client.auth.stopAutoRefresh();
});
test('SDK refreshes an expired legacy session before a data request',async()=>{
  const storage=memoryStorage();
  const jwt=(exp:number)=>['header',Buffer.from(JSON.stringify({exp,sub:'user-1',session_id:'planning-owner'})).toString('base64url'),'signature'].join('.');
  const expired=jwt(1),fresh=jwt(Math.floor(Date.now()/1000)+3600);
  storage.setItem('ekwo-lustre-session',JSON.stringify({access_token:expired,refresh_token:'refresh',expires_at:1,user:{id:'user-1'}}));
  let refreshes=0,authorization='';
  const client=createDataClient('https://example.test','public-key',storage,async(input,init)=>{
    const url=new URL(String(input));
    if(url.pathname==='/auth/v1/token'){
      refreshes++;assert.equal(url.searchParams.get('grant_type'),'refresh_token');
      return new Response(JSON.stringify({access_token:fresh,refresh_token:'next-refresh',expires_in:3600,token_type:'bearer',user:{id:'user-1'}}),{headers:{'Content-Type':'application/json'}});
    }
    if(url.pathname.endsWith('ekwo_schema_version'))return new Response('"0.24.0"',{headers:{'Content-Type':'application/json'}});
    authorization=new Headers(init?.headers).get('Authorization')??'';
    return new Response('[]',{headers:{'Content-Type':'application/json'}});
  });
  await client.companies();
  assert.equal(refreshes,1);assert.equal(authorization,'Bearer '+fresh);
  assert.equal(JSON.parse(storage.getItem('ekwo-lustre-session')!).refresh_token,'next-refresh');
  client.auth.stopAutoRefresh();
});
