// data-client.ts
import { createClient, FunctionsHttpError } from '@supabase/supabase-js';
import {saveJournalDraft, type JournalInput} from './journal.ts';

// Ekwo core intentionally delegates CRUD and transport to this SDK.
// Keep application RPC names here; accounting policy remains in the database.
export function createDataClient(url: string, key: string, storage: Storage, fetcher?: typeof fetch) {
  const db = createClient(url, key, {
    auth: { storage, storageKey: 'ekwo-lustre-session', persistSession: true,
      autoRefreshToken: true, detectSessionInUrl: false },
    ...(fetcher ? { global: { fetch: fetcher } } : {}),
  });
  async function value<T>(query: PromiseLike<{data: T; error: {message: string} | null}>) {
    const {data, error} = await query;
    if (error) throw new Error(error.message);
    return data;
  }
  return {
    auth: db.auth,
    companies: () => value(db.from('companies').select('id,name,legal_name,country,currency_code,language').order('name')),
    accounts: (company: string) => value(db.from('accounts').select('id,code,name').eq('company_id', company).order('code')),
    rounding: async (company: string) => {
      const data=await value(db.rpc('rounding_of',{p_company_id:company}));
      return Array.isArray(data)?data[0]:data;
    },
    saveJournal: (request:string, company:string, scenario:string, batch:string, input:JournalInput) =>
      saveJournalDraft(db,storage,request,company,scenario,batch,input),
    rpc: (name: string, args: Record<string, unknown> = {}) => value(db.rpc('lustre_' + name, args)),
    async report(body: Record<string, unknown>) {
      const {data, error} = await db.functions.invoke('report-run', {body});
      if (error instanceof FunctionsHttpError) {
        const response = error.context as Response;
        const detail = await response.json().catch(() => null) as {message?: string; error?: string} | null;
        throw new Error(detail?.message || detail?.error || error.message);
      }
      if (error) throw error;
      return data;
    },
  };
}
