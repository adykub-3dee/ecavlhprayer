// Zdielane ciste funkcie pre klienta, backend a testy.
export const START_DATE = '2026-11-09';
export const TOTAL_DAYS = 40;
export const TIMEZONE = 'Europe/Bratislava';
export function dateAfter(iso, offset) {
  const [year,month,day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month-1, day+offset, 12));
}
export function dateISO(date) {return date.toISOString().slice(0,10);}
export function makeDays(){
  return Array.from({length:TOTAL_DAYS},(_,i)=>{
    const date=dateAfter(START_DATE,i);
    const nice=new Intl.DateTimeFormat('sk-SK',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}).format(date);
    const short=new Intl.DateTimeFormat('sk-SK',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
    return {number:i+1,iso:dateISO(date),nice,short};
  });
}
export function slovakToday(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const fields=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}
export function cleanOneLine(value,max=90){
  if(typeof value!=='string')return '';
  return value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
export function cleanParagraph(value,max=1200){
  if(typeof value!=='string')return '';
  return value.replace(/\r/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max);
}
