// Shared display convention; date inputs and database values retain ISO dates.
const dates=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'UTC'});
export function displayDate(value){
  if(!value)return '';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?String(value):dates.format(date).replaceAll(' ','\u00a0');
}
export const displayEntryDate=entry=>(entry.display_date??displayDate(entry.entry_date)).replaceAll(' ','\u00a0');
export function summaryEntry(entry){
 const match=String(entry.reference||'').match(/ \| (\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})$/);
 return {...entry,display_date:match?`${displayDate(`${match[1]}-${match[2]}-${match[3]}`)}–${displayDate(`${match[4]}-${match[5]}-${match[6]}`)}`:displayDate(entry.entry_date)};
}
