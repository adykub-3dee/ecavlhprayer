import test from 'node:test';
import assert from 'node:assert/strict';
import {apiFileUrl,getRepository,base64Decode,base64Encode,cleanRecords,applyChange,saveChange,decryptToken,StoreError} from '../js/github-store.mjs';
const sample=()=>({version:1,claims:{},topics:[]});
const repo={owner:'test-user',repo:'test-repo',branch:'main'};

test('detekcia repozitara, URL a Unicode v JSON',()=>{
  assert.deepEqual(getRepository({owner:'x',repo:'y',branch:'main'},{hostname:'adykub-3dee.github.io',pathname:'/40-dni-modlitieb/'}),{owner:'adykub-3dee',repo:'40-dni-modlitieb',branch:'main'});
  assert.equal(apiFileUrl(repo,'data/records.json'),'https://api.github.com/repos/test-user/test-repo/contents/data/records.json');
  const text=JSON.stringify({name:'Štefan Černý 😊',desc:'Za zbor'});
  assert.equal(base64Decode(base64Encode(text)),text);
});
test('40 dni: platne pridanie, bez prepisu obsadeneho dna, editacia, zrusenie',()=>{
  let state=applyChange(sample(),{kind:'claim',day:1,name:'Ján Novák'},'2026-10-28T10:00:00Z','2026-10-28');
  assert.equal(state.claims[1].name,'Ján Novák');
  assert.throws(()=>applyChange(state,{kind:'claim',day:1,name:'Eva Černá'},undefined,'2026-10-28'),e=>e.status===409);
  state=applyChange(state,{kind:'edit-claim',day:1,name:'Eva Černá'});
  assert.equal(state.claims[1].name,'Eva Černá');
  state=applyChange(state,{kind:'delete-claim',day:1});
  assert.equal(state.claims[1],undefined);
  assert.throws(()=>applyChange(sample(),{kind:'claim',day:1,name:'Eva Černá'},undefined,'2026-11-10'),/Uplynulý/);
  assert.throws(()=>applyChange(sample(),{kind:'claim',day:41,name:'Eva Černá'}),/Nesprávny deň/);
});
test('pridanie, uprava a vymazanie nametu, bez zmeny originalu',()=>{
  const before=sample(),id='12345678-test';
  let next=applyChange(before,{kind:'add-topic',id,topic:{title:'Deti a mládež',description:'Pomoc\na pokoj'}},'2026-10-28T10:00:00Z');
  assert.equal(next.topics[0].title,'Deti a mládež');assert.equal(before.topics.length,0);
  next=applyChange(next,{kind:'edit-topic',id,topic:{title:'Rodiny',description:'Pokoj'}});
  assert.equal(next.topics[0].description,'Pokoj');
  next=applyChange(next,{kind:'delete-topic',id});assert.equal(next.topics.length,0);
});
test('cistenie neplatnych zaznamov',()=>{
  const state=cleanRecords({version:1,claims:{'1':{name:' Anna '},'60':{name:'Hack'}},topics:[]});
  assert.equal(state.claims[1].name,'Anna');assert.equal(state.claims[60],undefined);
});
test('sifrovany token: spravne heslo a odmietnutie zleho',async()=>{
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const password='Unikatne heslo na rok 2026';
  const base64=u=>btoa(String.fromCharCode(...u));
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:350000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt']);
  const token='github_pat_FAKE_TEST_TOKEN_123456';
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(token));
  const auth={version:1,algorithm:'PBKDF2-AES-GCM',iterations:350000,salt:base64(salt),iv:base64(iv),ciphertext:base64(new Uint8Array(cipher))};
  assert.equal(await decryptToken(password,auth),token);
  await assert.rejects(()=>decryptToken('zle-heslo',auth),/Nesprávne spoločné heslo/);
  await assert.rejects(()=>decryptToken('neexistuje',{enabled:false}),/nie je nastavené/);
});
test('súbežné zápisy: sha konflikt a opakovanie s aktualnymi datami',async()=>{
  let records=sample();let sha='sha1';let conflicts=0;let reads=0;
  const fetchImpl=async (url,opts)=>{
    if(opts.method==='PUT'){
      const body=JSON.parse(opts.body);
      if(conflicts++===0){records=applyChange(records,{kind:'claim',day:2,name:'Iný človek'},'2026-10-28T10:00:00Z','2026-10-28');sha='sha2';return {ok:false,status:409,json:async()=>({message:'Conflict'})};}
      if(body.sha!==sha)throw Error('missing retry');
      records=JSON.parse(base64Decode(body.content));sha='sha3';return {ok:true,status:200,json:async()=>({content:{sha}})};
    }
    reads++;
    return {ok:true,status:200,json:async()=>({type:'file',sha,content:base64Encode(JSON.stringify(records))})};
  };
  const result=await saveChange(repo,'github_pat_FAKE_TEST_TOKEN_123',{kind:'claim',day:1,name:'Ja'},{fetchImpl});
  assert.equal(conflicts,2);assert.equal(reads,2);
  assert.equal(result.claims[1].name,'Ja');assert.equal(result.claims[2].name,'Iný človek');
});
