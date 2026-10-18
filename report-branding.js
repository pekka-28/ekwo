// Native invoice convention: PNG/JPEG, at most 2 MB; embed bytes for offline reports.
export async function reportLogo(company,{project,token,key,fetcher=fetch}={}){
 const source=String(company.logo_url||'').trim();if(!source)return {logo:null};
 try{
  let url,headers={};
  if(/^https:\/\//i.test(source))url=new URL(source);
  else if(!/^[a-z][a-z0-9+.-]*:/i.test(source)&&!source.startsWith('/')&&!source.split('/').some(p=>p==='..')){
   url=new URL('/storage/v1/object/authenticated/'+source.split('/').map(encodeURIComponent).join('/'),project);
   headers={apikey:key,Authorization:'Bearer '+token};
  }else throw Error('Use an HTTPS logo URL or a bucket/path in project storage.');
  const response=await fetcher(url.href,{headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Logo retrieval returned '+response.status+'.');
  const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>2097152)throw Error('Logo exceeds the native 2 MB limit.');
  const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b),jpg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!png&&!jpg)throw Error('Use a PNG or JPEG logo, as for native Ekwo invoices.');
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {logo:'data:image/'+(png?'png':'jpeg')+';base64,'+btoa(binary)};
 }catch(error){return {logo:null,warning:'Report created without the company logo. '+error.message};}
}
