// Shared display convention; date inputs and database values retain ISO dates.
const dates=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'UTC'});
export function displayDate(value){
  if(!value)return '';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?String(value):dates.format(date).replaceAll(' ','\u00a0');
}
export const displayEntryDate=entry=>entry.period_start&&entry.period_end&&entry.period_start!==entry.period_end?displayDate(entry.period_start)+'–'+displayDate(entry.period_end):(entry.display_date??displayDate(entry.entry_date)).replaceAll(' ','\u00a0');
