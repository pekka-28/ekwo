// journal.ts
import type {SupabaseClient} from '@supabase/supabase-js';

export interface JournalInput {
  p_date: string; p_description: string; p_reference: string; p_source: string | null;
  p_lines: {account_id: string; name: string; debit: string; credit: string}[];
}
interface Attempt {
  company: string; scenario: string; batch: string; input: JournalInput;
  lineIds: string[];
}
function amount(text: string, decimals: number): bigint {
  if(!Number.isInteger(decimals)||decimals<0||decimals>20)throw new Error('Invalid currency precision.');
  if(!/^\d+(?:\.\d+)?$/.test(text))throw new Error('Enter a nonnegative decimal amount.');
  const [whole, fraction='']=text.split('.');
  if(/[^0]/.test(fraction.slice(decimals)))throw new Error(`Use amounts with at most ${decimals} decimal places for this currency.`);
  return BigInt(whole!)*10n**BigInt(decimals)+BigInt(fraction.slice(0,decimals).padEnd(decimals,'0')||'0');
}
function validate(input: JournalInput, decimals:number) {
  if(!input.p_description.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.p_date))throw new Error('Enter a date and description.');
  let debit=0n,credit=0n;
  for(const line of input.p_lines){
    const d=amount(line.debit,decimals),c=amount(line.credit,decimals);
    if(!line.account_id || (d===0n)===(c===0n))throw new Error('Each line needs an account and either a positive debit or credit.');
    debit+=d;credit+=c;
  }
  if(input.p_lines.length<2 || debit===0n || debit!==credit)throw new Error('Debits and credits must balance.');
}

// Ekwo's manual draft primitives are native table writes. The client library's
// postEntry operation is deliberately NOT called: capture must remain a draft.
export async function saveJournalDraft(db: SupabaseClient, storage: Storage,
  request: string, company: string, scenario: string, batch: string, input: JournalInput): Promise<string> {
  const rounding=await db.rpc('rounding_of',{p_company_id:company});
  if(rounding.error)throw new Error(rounding.error.message);
  const decimals:number=(Array.isArray(rounding.data)?rounding.data[0]:rounding.data)?.decimals;
  validate(input,decimals);
  const key='ekwo-journal-draft:'+request;
  const saved=storage.getItem(key);
  const attempt:Attempt=saved?JSON.parse(saved):{company,scenario,batch,input,lineIds:input.p_lines.map(()=>crypto.randomUUID())};
  if(JSON.stringify([attempt.company,attempt.scenario,attempt.batch,attempt.input])!==JSON.stringify([company,scenario,batch,input])){
    throw new Error('This save is pending. Retry its original values before starting a different journal. Draft '+request);
  }
  // Retain the request before any mutation. An uncertain response must never
  // cause a second entry, nor an automatic deletion of a possibly complete one.
  const checked=async<T>(query:PromiseLike<{data:T;error:{message:string}|null}>)=>{
    const result=await query;if(result.error)throw new Error(result.error.message);return result.data;
  };
  // Fail closed on old installations: the private migration adds admission
  // guards to native writes, not another journal-creation routine.
  if(await checked(db.rpc('lustre_native_journal_ready'))!==true)throw new Error('Native journal capture is not installed.');
  storage.setItem(key,JSON.stringify(attempt));
  const readHeader=()=>checked(db.from('entries').select('id,company_id,state,entry_date,description,reference,currency_code,lustre_batch_id,lustre_origin_entry_id')
    .eq('company_id',company).eq('id',request).maybeSingle());
  let entry=await readHeader();
  if(!entry){
    const co=await checked(db.from('companies').select('miscellaneous_journal_id,currency_code').eq('id',company).single());
    if(!co?.miscellaneous_journal_id)throw new Error('Company miscellaneous journal is not configured.');
    const year=await checked(db.from('fiscal_years').select('id').eq('company_id',company).lte('start_date',input.p_date).gte('end_date',input.p_date).single());
    if(!year)throw new Error('Create an accounting period covering this date first.');
    const result=await db.from('entries').insert({id:request,company_id:company,journal_id:co.miscellaneous_journal_id,
      fiscal_year_id:year.id,currency_code:co.currency_code,state:'draft',entry_date:input.p_date,
      description:input.p_description.trim(),reference:input.p_reference.trim()||null,lustre_origin_entry_id:input.p_source})
      .setHeader('x-lustre-scenario',scenario);
    if(result.error){
      // A timeout or duplicate key can follow a committed insertion.
      entry=await readHeader();if(!entry)throw new Error(result.error.message);
    }else entry=await readHeader();
  }
  if(!entry || entry.state!=='draft' || entry.lustre_batch_id!==batch || entry.entry_date!==input.p_date ||
    entry.description!==input.p_description.trim() || (entry.reference??'')!==input.p_reference.trim() ||
    (entry.lustre_origin_entry_id??null)!==input.p_source)throw new Error('Draft identity, capture destination or content changed. Inspect draft '+request);
  const readLines=async()=>await checked(db.from('entry_lines').select('id,account_id,sequence,name,debit::text,credit::text').eq('company_id',company).eq('entry_id',request).order('sequence'))??[];
  const matches=(rows:Record<string,unknown>[])=>rows.length===input.p_lines.length&&rows.every((row,index)=>{
    const line=input.p_lines[index]!;
    return row.id===attempt.lineIds[index]&&row.account_id===line.account_id&&row.sequence===index+1&&
      (row.name??'')===line.name&&amount(String(row.debit),decimals)===amount(line.debit,decimals)&&amount(String(row.credit),decimals)===amount(line.credit,decimals);
  });
  let lines=await readLines();
  if(!lines.length){
    const result=await db.from('entry_lines').insert(input.p_lines.map((line,index)=>({...line,
      id:attempt.lineIds[index],company_id:company,entry_id:request,sequence:index+1,currency_code:entry.currency_code})))
      .setHeader('x-lustre-scenario',scenario);
    lines=await readLines();
    if(result.error&&!matches(lines))throw new Error(result.error.message+'; draft '+request+' retained. Retry the same save.');
  }
  if(!matches(lines))throw new Error('Draft lines differ from this save. Inspect draft '+request);
  // Caller clears recovery state only after refreshing the view successfully.
  return request;
}
