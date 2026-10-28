import {makeDays,slovakToday,cleanOneLine} from './core.mjs';
import {AUTH_PATH,getRepository,readRecords,readGitHubFile,decryptToken,saveChange} from './github-store.mjs';

const config=window.PRAYER_CONFIG||{};
const repository=getRepository(config);
const intervalMs=Math.max(1,Number(config.refreshMinutes)||1)*60_000;
const days=makeDays();
const site={claims:{},topics:[],drafts:{},today:slovakToday(),selectedDay:1,editingDay:null,editingTopic:null,token:'',pending:null,busy:false,loading:false,loaded:false,fetchedAt:0};
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let toastTimeout;
function toast(message){const el=$('toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.hidden=true,5500);}
function setSync(message,isError=false){$('sync-state').textContent=message;$('sync-state').classList.toggle('error',isError);}
function activeNumber(){return days.find(d=>d.iso===site.today)?.number||null;}
function renderDate(){
  const active=activeNumber();
  if(site.today<days[0].iso)$('date-status').textContent='Modlitebná reťaz sa začne 9. novembra 2026. Zapísať sa môžete už teraz.';
  else if(site.today>days.at(-1).iso)$('date-status').textContent='Modlitebná reťaz sa skončila 18. decembra 2026. Ďakujeme všetkým.';
  else $('date-status').textContent=`Práve prebieha ${active}. deň zo 40. · ${days[active-1].nice}`;
}
function renderProgress(){
  const count=Object.keys(site.claims).length;
  $('filled-count').innerHTML=`${count} <small>/ 40</small>`;
  $('percent').textContent=`${Math.round(count/40*100)} %`;
  $('progress-fill').style.width=`${count/40*100}%`;
  $('progress-meter').setAttribute('aria-valuenow',String(count));
  $('topic-badge').textContent=String(site.topics.length);
  $('lock-button').textContent=site.token?'🔓 Odomknuté':'🔒 Odomknúť';
  $('lock-button').title=site.token?'Kliknutím odhlásite toto zariadenie.':'Zadajte spoločné heslo pre zápis alebo úpravy.';
}
function renderTimeline(){
  const active=activeNumber();
  $('timeline').innerHTML=days.map(d=>{
    const claimed=Boolean(site.claims[d.number]);
    const classes=[d.number===active?'today':'',claimed?'claimed':'',d.iso<site.today?'past':''].filter(Boolean).join(' ');
    return `<button type="button" class="${classes}" data-select-day="${d.number}" title="${esc(d.nice)} — ${claimed?'obsadený':'voľný'}" aria-label="Deň ${d.number}, ${esc(d.nice)}, ${claimed?'obsadený':'voľný'}" ${d.number===site.selectedDay?'aria-current="true"':''}>${d.number}</button>`;
  }).join('');
}
function renderDay(d){
  const claim=site.claims[d.number];
  const isToday=d.iso===site.today,isPast=d.iso<site.today,editing=site.editingDay===d.number;
  const classes=['day-card',isToday?'is-today':'',isPast?'is-past':'',claim?'is-claimed':''].filter(Boolean).join(' ');
  let content;
  if(claim&&!editing){
    content=`<div class="card-pill"><span class="checkmark" aria-hidden="true">✓</span><small>ZA TENTO DEŇ SA MODLÍ</small><strong>${esc(claim.name)}</strong></div>
     <div class="card-actions"><button class="edit-link" type="button" data-edit-day="${d.number}">✎ Upraviť meno</button><button class="edit-link danger-link" type="button" data-delete-day="${d.number}">Zrušiť zápis</button></div>`;
  }else if(isPast&&!editing){
    content='<div class="card-empty">Tento deň už uplynul.<br>Na uplynulý deň sa nedá zapísať.</div>';
  }else{
    content=`<form data-day-form="${d.number}" class="card-form">
      <label for="name-${d.number}">${editing?'Upraviť meno zapísaného':'Zaregistrovať sa na tento deň'}</label>
      <input class="card-input" id="name-${d.number}" data-draft-day="${d.number}" type="text" maxlength="90" minlength="2" autocomplete="name" placeholder="Meno a priezvisko" value="${esc(site.drafts[d.number]??(editing?claim?.name:'')??'')}" required>
      <button class="button button-primary card-submit" type="submit" ${!site.loaded||cleanOneLine(site.drafts[d.number]??(editing?claim?.name:'')??'').length<2?'disabled':''}>${editing?'Uložiť zmeny':'Zapísať sa'}</button>
      ${editing?`<button class="edit-link cancel-edit" type="button" data-cancel-edit="${d.number}">Zrušiť úpravu</button>`:''}
      <div class="card-note">${editing?'Zmena sa uloží do spoločného rozpisu.':'Na zápis stačí spoločné heslo. GitHub účet nepotrebujete.'}</div>
    </form>`;
  }
  return `<article class="${classes}" id="day-${d.number}" data-day="${d.number}" aria-label="Deň ${d.number}, ${esc(d.nice)}">
    ${isToday?'<span class="card-ribbon">AKTUÁLNY DEŇ</span>':''}
    <div class="card-number">DEŇ ${String(d.number).padStart(2,'0')} / 40</div>
    <h4>${esc(d.nice)}</h4><div class="card-date">${esc(d.short)} · ${claim?'Obsadený':isPast?'Uplynul':'Voľný'}</div>
    <div class="card-divider"></div><div class="card-body">${content}</div>
    </article>`;
}
function renderCards(){
  const container=$('carousel');const previous=container.scrollLeft;
  const active=document.activeElement;
  const focusId=active?.id?.startsWith('name-')?active.id:null;
  let selectStart=null,selectEnd=null;
  if(focusId){selectStart=active.selectionStart;selectEnd=active.selectionEnd;}
  container.innerHTML=days.map(renderDay).join('');container.scrollLeft=previous;
  if(focusId&&$(focusId)){const field=$(focusId);field.focus({preventScroll:true});if(selectStart!==null)field.setSelectionRange(selectStart,selectEnd);}
}
function renderTopics(){
  const node=$('topics-list');
  if(!site.loaded){node.innerHTML='<p class="card-empty">Načítavam námety…</p>';return;}
  if(!site.topics.length){node.innerHTML='<p class="card-empty">Zatiaľ nie sú pridané žiadne námety.</p>';return;}
  node.innerHTML=site.topics.map(t=>`<article class="topic"><h3>${esc(t.title)}</h3>${t.description?`<p>${esc(t.description)}</p>`:''}
  <div class="topic-meta"><button class="topic-action" type="button" data-edit-topic="${esc(t.id)}">Upraviť</button><button class="topic-action danger-link" type="button" data-delete-topic="${esc(t.id)}">Vymazať</button></div></article>`).join('');
}
function render(){renderDate();renderProgress();renderTimeline();renderCards();renderTopics();}
function scrollDay(num,smooth=true){
  const card=$(`day-${num}`);if(!card)return;
  site.selectedDay=num;
  $('timeline').querySelectorAll('[aria-current="true"]').forEach(x=>x.removeAttribute('aria-current'));
  $('timeline').querySelector(`[data-select-day="${num}"]`)?.setAttribute('aria-current','true');
  const el=$('carousel'),left=card.offsetLeft-el.offsetLeft;
  el.scrollTo({left:Math.max(0,left),behavior:smooth?'smooth':'instant'});
}
async function loadData(){
  if(site.loading||site.busy)return;
  site.loading=true;$('refresh-button').disabled=true;
  setSync('Aktualizujem spoločný rozpis z GitHubu…');
  try{
    const {records}=await readRecords(repository,{token:site.token});
    site.claims=records.claims;site.topics=records.topics;
    site.loaded=true;site.fetchedAt=Date.now();render();
    const when=new Intl.DateTimeFormat('sk-SK',{timeZone:'Europe/Bratislava',hour:'2-digit',minute:'2-digit'}).format(new Date());
    setSync(`Údaje aktualizované o ${when} · GitHub repozitár`);
  }catch(err){setSync(err.message,true);if(!site.loaded)toast(err.message);}
  finally{site.loading=false;$('refresh-button').disabled=false;}
}
function showPassword(){
  $('password-overlay').hidden=false;document.body.style.overflow='hidden';$('password-input').value='';$('password-error').textContent='';$('password-input').focus();
}
function closePassword(clearPending=true){
  $('password-overlay').hidden=true;document.body.style.overflow='';$('password-input').value='';if(clearPending)site.pending=null;
}
function needAuth(action){
  site.pending=action;
  if(site.token){performPending();return;}
  showPassword();
}
async function login(e){
  e.preventDefault();const password=$('password-input').value;
  if(!password)return;
  const btn=$('login-submit');btn.disabled=true;btn.textContent='Overujem…';
  try{
    // Heslo sa neposiela na externy server. Lokalnym desifrovanim
    // odomkne obmedzeny Github personal access token.
    const {value:envelope}=await readGitHubFile(repository,AUTH_PATH);
    const token=await decryptToken(password,envelope);
    // Zistime, ci GitHub token este funguje.
    await readRecords(repository,{token});
    site.token=token;
    closePassword(false);renderProgress();toast('Heslo je správne. Úpravy sú odomknuté do zatvorenia stránky.');
    if(site.pending)await performPending();
  }catch(err){$('password-error').textContent=err.message;}
  finally{btn.disabled=false;btn.textContent='Odomknúť a pokračovať';}
}
async function performPending(){
  const task=site.pending;if(!task||site.busy)return;
  site.busy=true;
  try{
    const updated=await saveChange(repository,site.token,task);
    site.claims=updated.claims;site.topics=updated.topics;
    site.loaded=true;site.fetchedAt=Date.now();
    if(task.kind==='claim'||task.kind==='edit-claim'||task.kind==='delete-claim'){
      site.editingDay=null;delete site.drafts[task.day];
    }
    if(task.kind==='add-topic'||task.kind==='edit-topic')resetTopicForm();
    site.pending=null;render();toast('Zápis bol uložený priamo do GitHub repozitára.');
    const when=new Intl.DateTimeFormat('sk-SK',{timeZone:'Europe/Bratislava',hour:'2-digit',minute:'2-digit'}).format(new Date());
    setSync(`Zmeny uložené o ${when} · GitHub repozitár`);
  }catch(err){
    if(err.status===401){site.token='';renderProgress();site.pending=null;showPassword();}
    else{site.pending=null;toast(err.message);if(err.status===409)setTimeout(()=>loadData(),300);}
  }finally{site.busy=false;}
}
function resetTopicForm(){
  site.editingTopic=null;$('topic-title').value='';$('topic-description').value='';$('topic-form-label').textContent='Nový námet';
  $('topic-submit').textContent='Pridať námet';$('topic-cancel').hidden=true;
}
function openTopics(){$('topics-overlay').hidden=false;$('topics-close').focus();document.body.style.overflow='hidden';}
function closeTopics(){$('topics-overlay').hidden=true;document.body.style.overflow='';$('topics-button').focus();}
function updateToday(){
  const next=slovakToday();if(next!==site.today){site.today=next;render();const active=activeNumber();if(active)scrollDay(active);}
}
function bind(){
  $('topics-button').addEventListener('click',openTopics);
  $('topics-close').addEventListener('click',closeTopics);
  $('topics-overlay').addEventListener('click',e=>{if(e.target.dataset.closeTopics)closeTopics();});
  $('lock-button').addEventListener('click',()=>{if(site.token){site.token='';toast('Zamknuté.');renderProgress();}else{site.pending=null;showPassword();}});
  $('password-close').addEventListener('click',()=>closePassword());
  $('password-overlay').addEventListener('click',e=>{if(e.target.dataset.closePassword)closePassword();});
  $('password-form').addEventListener('submit',login);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('password-overlay').hidden)closePassword();else if(!$('topics-overlay').hidden)closeTopics();}});
  $('refresh-button').addEventListener('click',loadData);
  $('timeline').addEventListener('click',e=>{const b=e.target.closest('[data-select-day]');if(b)scrollDay(Number(b.dataset.selectDay));});
  $('slide-left').addEventListener('click',()=>$('carousel').scrollBy({left:-355,behavior:'smooth'}));
  $('slide-right').addEventListener('click',()=>$('carousel').scrollBy({left:355,behavior:'smooth'}));
  $('carousel').addEventListener('input',e=>{
    const input=e.target.closest('[data-draft-day]');if(!input)return;
    site.drafts[Number(input.dataset.draftDay)]=input.value;
    input.closest('form').querySelector('button[type="submit"]').disabled=cleanOneLine(input.value).length<2;
  });
  $('carousel').addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit-day]');if(edit){const day=Number(edit.dataset.editDay);site.editingDay=day;site.drafts[day]=site.claims[day]?.name||'';renderCards();$( `name-${day}`)?.focus();return;}
    const cancel=e.target.closest('[data-cancel-edit]');if(cancel){const day=Number(cancel.dataset.cancelEdit);site.editingDay=null;delete site.drafts[day];renderCards();return;}
    const del=e.target.closest('[data-delete-day]');if(del){const day=Number(del.dataset.deleteDay);if(confirm(`Naozaj zrušiť zápis na ${days[day-1].nice}?`))needAuth({kind:'delete-claim',day});}
  });
  $('carousel').addEventListener('submit',e=>{
    const form=e.target.closest('[data-day-form]');if(!form)return;e.preventDefault();
    const day=Number(form.dataset.dayForm),name=cleanOneLine(form.querySelector('input').value);
    if(name.length<2){toast('Zadajte meno a priezvisko.');return;}
    if(!site.loaded){toast('Najprv sa musí načítať spoločná databáza.');return;}
    if(site.editingDay!==day&&site.claims[day]){toast('Deň je už obsadený. Obnovte stránku.');return;}
    if(site.editingDay!==day&&days[day-1].iso<slovakToday()){toast('Uplynulý deň nemožno obsadiť.');return;}
    needAuth({kind:site.editingDay===day?'edit-claim':'claim',day,name});
  });
  $('topics-list').addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit-topic]');if(edit){
      const t=site.topics.find(x=>x.id===edit.dataset.editTopic);if(!t)return;
      site.editingTopic=t.id;$('topic-title').value=t.title;$('topic-description').value=t.description;
      $('topic-form-label').textContent='Upraviť námet';$('topic-submit').textContent='Uložiť námet';$('topic-cancel').hidden=false;$('topic-title').focus();return;
    }
    const del=e.target.closest('[data-delete-topic]');if(del){if(confirm('Naozaj odstrániť tento modlitebný námet?'))needAuth({kind:'delete-topic',id:del.dataset.deleteTopic});}
  });
  $('topic-cancel').addEventListener('click',resetTopicForm);
  $('topic-form').addEventListener('submit',e=>{
    e.preventDefault();const topic={title:$('topic-title').value.trim(),description:$('topic-description').value.trim()};
    if(topic.title.length<2){toast('Názov je príliš krátky.');return;}
    needAuth(site.editingTopic?{kind:'edit-topic',id:site.editingTopic,topic}:{kind:'add-topic',id:crypto.randomUUID(),topic});
  });
  window.addEventListener('focus',()=>{if(Date.now()-site.fetchedAt>45000)loadData();updateToday();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(Date.now()-site.fetchedAt>45000)loadData();updateToday();}});
  setInterval(()=>{if(!document.hidden)loadData();},intervalMs);
  setInterval(updateToday,60_000);
}
function boot(){
  site.selectedDay=activeNumber()||days.find(x=>x.iso>=site.today)?.number||40;
  bind();render();requestAnimationFrame(()=>scrollDay(site.selectedDay,false));loadData();
}
boot();
