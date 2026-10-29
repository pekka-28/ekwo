// data-client.ts
import { createClient, FunctionsHttpError } from '@supabase/supabase-js';
import {saveJournalDraft, type JournalInput} from './journal.ts';

// Ekwo core intentionally delegates CRUD and transport to this SDK.
// Keep application RPC names here; accounting policy remains in the database.
export function createDataClient(url: string, key: string, storage: Storage, fetcher?: typeof fetch) {
  const transport = fetcher ?? globalThis.fetch.bind(globalThis);
  const compatibleFetch: typeof fetch = (input, init) => {
    const target = new URL(input instanceof Request ? input.url : String(input));
    if (target.origin === new URL(url).origin && target.pathname === '/functions/v1/report-run') {
      // The deployed worker predates the SDK's optional client-info header.
      // Keep auth and payload intact; avoid a rejected browser preflight.
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.delete('x-client-info');
      return transport(input, {...init, headers});
    }
    return transport(input, init);
  };
  const db = createClient(url, key, {
    auth: { storage, storageKey: 'ekwo-lustre-session', persistSession: true,
      autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: compatibleFetch },
  });
  async function value<T>(query: PromiseLike<{data: T; error: {message: string} | null}>) {
    const {data, error} = await query;
    if (error) throw new Error(error.message);
    return data;
  }
  let accounting: Promise<ReturnType<typeof db.schema>> | undefined;
  const native = () => accounting ??= (async () => {
    const moved = db.schema('ekwo');
    const {data, error} = await moved.rpc('ekwo_schema_version');
    if (!error && typeof data === 'string') return moved;
    if (error && ['PGRST106', 'PGRST202'].includes(error.code)) return db.schema('public');
    throw new Error(error?.message || 'Invalid accounting schema version response');
  })().catch(error => { accounting = undefined; throw error; });
  return {
    auth: db.auth,
    companies: async () => value((await native()).from('companies').select('id,name,legal_name,country,currency_code,language').order('name')),
    accounts: async (company: string) => value((await native()).from('accounts').select('id,code,name').eq('company_id', company).order('code')),
    rounding: async (company: string) => {
      const data=await value((await native()).rpc('rounding_of',{p_company_id:company}));
      return Array.isArray(data)?data[0]:data;
    },
    saveJournal: async (request:string, company:string, scenario:string, batch:string, input:JournalInput) =>
      saveJournalDraft(db,storage,request,company,scenario,batch,input,await native()),
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
