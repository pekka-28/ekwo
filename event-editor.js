import {minorUnits,money} from './events-view.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function openEventEditor({editor,accounts,entries,save}){
 const options='<option value="">Choose account</option>'+accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.code)} · ${esc(a.name)}</option>`).join('');
 const line=()=>`<tr><td><select class="event-account" aria-label="Account" required>${options}</select></td><td><input class="event-line-name" aria-label="Line description"></td><td><input class="event-debit" aria-label="Debit" inputmode="decimal" value="0"></td><td><input class="event-credit" aria-label="Credit" inputmode="decimal" value="0"></td><td><button type="button" class="remove-line" aria-label="Remove line">×</button></td></tr>`;
 const local=new Date(),today=[local.getFullYear(),String(local.getMonth()+1).padStart(2,'0'),String(local.getDate()).padStart(2,'0')].join('-');
 editor('Add event',`<div class="event-header-fields"><label>Date<input name="date" type="date" required value="${today}"></label><label>Reference<input name="reference"></label></div><label>Description<input name="description" required></label><label>Related event<select name="source"><option value="">None</option>${entries.filter(e=>e.state!=='cancelled').map(e=>`<option value="${esc(e.id)}">${esc(e.entry_date)} · ${esc(e.description)}</option>`).join('')}</select></label><div class="event-scroll"><table class="entry-input"><thead><tr><th>Account</th><th>Description</th><th>Debit</th><th>Credit</th><th></th></tr></thead><tbody id="event-lines">${line()+line()}</tbody></table></div><button type="button" id="add-event-line">Add line</button><p id="event-totals" role="status"></p>`,async data=>{
   const lines=[...document.querySelectorAll('#event-lines tr')].map(row=>({account_id:row.querySelector('.event-account').value,name:row.querySelector('.event-line-name').value,debit:row.querySelector('.event-debit').value.trim()||'0',credit:row.querySelector('.event-credit').value.trim()||'0'}));
   const debit=lines.reduce((n,l)=>n+minorUnits(l.debit),0n),credit=lines.reduce((n,l)=>n+minorUnits(l.credit),0n);
   if(lines.length<2||debit<=0n||debit!==credit)throw Error('Enter at least two lines with equal debit and credit totals.');
   await save({p_date:data.get('date'),p_description:data.get('description'),p_reference:data.get('reference'),p_source:data.get('source')||null,p_lines:lines});
 });
 const rows=document.getElementById('event-lines');
 function totals(){try{let debit=0n,credit=0n;for(const row of rows.rows){debit+=minorUnits(row.querySelector('.event-debit').value.trim()||'0');credit+=minorUnits(row.querySelector('.event-credit').value.trim()||'0');}document.getElementById('event-totals').textContent=`Debit ${money(debit)} · Credit ${money(credit)} · Difference ${money(debit-credit)}`;}catch{document.getElementById('event-totals').textContent='Use amounts with at most two decimal places.';}}
 rows.oninput=totals;rows.onclick=e=>{if(e.target.closest('.remove-line')){e.target.closest('tr').remove();totals();}};
 document.getElementById('add-event-line').onclick=()=>{rows.insertAdjacentHTML('beforeend',line());totals();};totals();
}
