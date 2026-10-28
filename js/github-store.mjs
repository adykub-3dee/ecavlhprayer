// Jedina backendova sluzba je GitHub REST API. Ziadny Firebase ani Cloudflare.
// Sifrovany PAT z auth.json sa odomkne len heslom zadanym navstevnikom.
import {cleanOneLine,cleanParagraph,slovakToday,makeDays} from './core.mjs';

export const DATA_PATH='data/records.json';
export const AUTH_PATH='data/auth.json';
const nowDays=makeDays();

export function getRepository(config,loc=typeof window!=='undefined'?window.location:null){
  let owner=config.owner,repo=config.repo;
  if(loc && /^([\w-]+)\.github\.io$/i.test(loc.hostname) && loc.pathname.split('/').filter(Boolean)[0]){
    owner=loc.hostname.split('.')[0]; repo=loc.pathname.split('/').filter(Boolean)[0];
  }
  const branch=String(config.branch||'main');
  if(!/^[\w.-]+$/.test(owner||'')||!/^[\w.-]+$/.test(repo||'')||!/^[\w./-]+$/.test(branch)){
    throw new Error('Nesprávne nastavený GitHub účet alebo repozitár v config.js.');
  }
  return {owner,repo,branch};
}
export function apiFileUrl(repository,path){
  const parts=path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/contents/${parts}`;
}
export function base64Encode(text){
  const bytes=new TextEncoder().encode(text);
  let binary=''; for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
export function base64Decode(str){
  const binary=atob(str.replace(/\s/g,''));
  const bytes=Uint8Array.from(binary,x=>x.charCodeAt(0));
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export class StoreError extends Error {
  constructor(message,status=0){super(message);this.name='StoreError';this.status=status;}
}
function gitErrorMessage(data,status,hasToken){
  if(status===404)return 'Repozitár alebo databázový súbor nie je dostupný. Skontrolujte názov repozitára a nahrané súbory.';
  if(status===401)return 'GitHub token nie je platný alebo jeho platnosť vypršala. Organizátor musí obnoviť nastavenie.';
  if(status===403 && hasToken)return 'GitHub zamietol zápis. Skontrolujte povolenie Contents: Read and write a platnosť tokenu.';
  if(status===403||status===429)return 'GitHub dočasne obmedzil počet požiadaviek. Skúste to o chvíľu znova.';
  return `GitHub vrátil chybu ${status}${data?.message?`: ${String(data.message).slice(0,160)}`:''}.`;
}
async function githubRequest(url,{method='GET',token='',json=null,fetchImpl=fetch}={}){
  const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  if(token)headers.Authorization=`Bearer ${token}`;
  if(json!==null)headers['Content-Type']='application/json';
  let response;
  try{response=await fetchImpl(url,{method,headers,body:json===null?undefined:JSON.stringify(json),cache:'no-store'});}
  catch{throw new StoreError('Nepodarilo sa spojiť s GitHubom. Skontrolujte internetové pripojenie.');}
  let value;
  try{value=await response.json();}catch{throw new StoreError('GitHub nevrátil platnú odpoveď.',response.status);}
  if(!response.ok)throw new StoreError(gitErrorMessage(value,response.status,Boolean(token)),response.status);
  return value;
}
export async function readGitHubFile(repository,path,{token='',fetchImpl=fetch}={}){
  const url=`${apiFileUrl(repository,path)}?ref=${encodeURIComponent(repository.branch)}&_=${Date.now()}`;
  const file=await githubRequest(url,{token,fetchImpl});
  if(!file.sha||file.type!=='file'||typeof file.content!=='string')throw new StoreError('Neočakávaný formát súboru na GitHube.');
  try{return {sha:file.sha,value:JSON.parse(base64Decode(file.content))};}
  catch{throw new StoreError(`Súbor ${path} nemá správny formát JSON.`);}
}
export function cleanRecords(raw){
  if(!raw||typeof raw!=='object'||raw.version!==1||!raw.claims||typeof raw.claims!=='object'||!Array.isArray(raw.topics)){
    throw new StoreError('Databáza records.json má nesprávny formát.');
  }
  const claims={};
  for(const [key,value] of Object.entries(raw.claims)){
    const number=Number(key);
    if(!Number.isInteger(number)||number<1||number>40||!value||typeof value!=='object')continue;
    const name=cleanOneLine(value.name,90);
    if(name)claims[number]={name,updatedAt:typeof value.updatedAt==='string'?value.updatedAt:''};
  }
  const topics=raw.topics.slice(0,300).filter(t=>t&&typeof t==='object'&&typeof t.id==='string'&&t.id.length<100)
    .map(t=>({id:t.id,title:cleanOneLine(t.title,100),description:cleanParagraph(t.description,1200),createdAt:String(t.createdAt||'')}))
    .filter(t=>t.title);
  return {version:1,claims,topics};
}
export async function readRecords(repository,opts={}){
  const file=await readGitHubFile(repository,DATA_PATH,opts);
  return {sha:file.sha,records:cleanRecords(file.value)};
}
export function applyChange(records,action,nowISO=new Date().toISOString(),today=slovakToday()){
  const state=cleanRecords(records);
  if(!action||typeof action!=='object')throw new StoreError('Neznáma požiadavka na úpravu.');
  const num=Number(action.day);
  if(['claim','edit-claim','delete-claim'].includes(action.kind)&&(!Number.isInteger(num)||num<1||num>40)){
    throw new StoreError('Nesprávny deň.');
  }
  if(action.kind==='claim'){
    const name=cleanOneLine(action.name,90);
    if(name.length<2)throw new StoreError('Zadajte meno a priezvisko.');
    if(nowDays[num-1].iso<today)throw new StoreError('Uplynulý deň už nemožno obsadiť.');
    if(state.claims[num])throw new StoreError('Tento deň už niekto obsadil. Záznam bol obnovený.',409);
    state.claims[num]={name,updatedAt:nowISO};
  }else if(action.kind==='edit-claim'){
    const name=cleanOneLine(action.name,90);
    if(name.length<2)throw new StoreError('Meno je príliš krátke.');
    if(!state.claims[num])throw new StoreError('Tento zápis už neexistuje.',409);
    state.claims[num]={name,updatedAt:nowISO};
  }else if(action.kind==='delete-claim'){
    if(!state.claims[num])throw new StoreError('Tento zápis už neexistuje.',409);
    delete state.claims[num];
  }else if(action.kind==='add-topic'){
    const title=cleanOneLine(action.topic?.title,100);
    if(title.length<2)throw new StoreError('Názov námetu je príliš krátky.');
    if(state.topics.length>=300)throw new StoreError('Bol dosiahnutý limit námetov.');
    if(!/^[a-zA-Z0-9-]{8,100}$/.test(action.id||''))throw new StoreError('Chýba identifikátor námetu.');
    if(state.topics.some(t=>t.id===action.id))throw new StoreError('Námet už bol pridaný.',409);
    state.topics.unshift({id:action.id,title,description:cleanParagraph(action.topic.description,1200),createdAt:nowISO});
  }else if(action.kind==='edit-topic'){
    const topic=state.topics.find(t=>t.id===action.id);
    if(!topic)throw new StoreError('Námet už bol vymazaný.',409);
    const title=cleanOneLine(action.topic?.title,100);
    if(title.length<2)throw new StoreError('Názov námetu je príliš krátky.');
    topic.title=title;topic.description=cleanParagraph(action.topic?.description,1200);
  }else if(action.kind==='delete-topic'){
    if(!state.topics.some(t=>t.id===action.id))throw new StoreError('Námet už bol vymazaný.',409);
    state.topics=state.topics.filter(t=>t.id!==action.id);
  }else throw new StoreError('Neznáma požiadavka na úpravu.');
  return state;
}
export async function saveChange(repository,token,action,{fetchImpl=fetch,attempts=5}={}){
  if(!token)throw new StoreError('Pred zápisom zadajte spoločné heslo.',401);
  for(let attempt=0;attempt<attempts;attempt++){
    const {records,sha}=await readRecords(repository,{token,fetchImpl});
    const updated=applyChange(records,action);
    const body={message:`Modlitebna retaz: ${action.kind}${action.day?' (den '+action.day+')':''}`,
      content:base64Encode(JSON.stringify(updated,null,2)+'\n'),sha,branch:repository.branch};
    try{
      await githubRequest(apiFileUrl(repository,DATA_PATH),{method:'PUT',token,json:body,fetchImpl});
      return updated;
    }catch(error){
      // Ak dvaja zapisu naraz, nacitame aktualny SHA a aplikujeme zmenu znovu.
      if(error.status===409 || (error.status===422 && attempt<attempts-1)){
        if(attempt===attempts-1)throw new StoreError('Veľa súbežných zmien. Obnovte stránku a skúste to znova.',409);
        await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)));
        continue;
      }
      throw error;
    }
  }
  throw new StoreError('Zápis sa nepodaril pre súbežné úpravy.',409);
}

function toBytes(value){
  const binary=atob(value);return Uint8Array.from(binary,ch=>ch.charCodeAt(0));
}
export async function decryptToken(password,envelope,cryptoImpl=globalThis.crypto){
  if(!envelope||envelope.version!==1||envelope.algorithm!=='PBKDF2-AES-GCM' || typeof envelope.salt!=='string'||typeof envelope.iv!=='string'||typeof envelope.ciphertext!=='string'){
    throw new StoreError('Spoločné heslo ešte nie je nastavené. Organizátor musí nahrať data/auth.json.');
  }
  if(!cryptoImpl?.subtle)throw new StoreError('Prehliadač nepodporuje šifrovanie. Stránku otvorte cez HTTPS.');
  try{
    const keyMaterial=await cryptoImpl.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    const key=await cryptoImpl.subtle.deriveKey({name:'PBKDF2',salt:toBytes(envelope.salt),iterations:350000,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['decrypt']);
    const plain=await cryptoImpl.subtle.decrypt({name:'AES-GCM',iv:toBytes(envelope.iv)},key,toBytes(envelope.ciphertext));
    const token=new TextDecoder().decode(plain).trim();
    if(!/^(github_pat_|ghp_)[a-zA-Z0-9_]+$/.test(token))throw Error('token');
    return token;
  }catch{throw new StoreError('Nesprávne spoločné heslo alebo poškodené nastavenie.');}
}
