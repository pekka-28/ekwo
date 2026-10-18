// Shared display convention; date inputs and database values retain ISO dates.
const dates=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'UTC'});
export function displayDate(value){
  if(!value)return '';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?String(value):dates.format(date);
}
