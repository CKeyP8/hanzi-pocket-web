/// <reference types="vite-plugin-pwa/client" />
import {registerSW} from 'virtual:pwa-register';
import {db} from './db';
import {exportBackup,parseBackup,exportCSV,parseCSV} from './backup';
import {suggestions} from './dictionary';
import {loadCatalog} from './catalog';
import {appAsset} from './assets';
import {ExperienceDB,openExperience,migrateLegacy,validateExperience,type ExperiencePayload} from './experience-storage';

async function start(){
 const root=document.getElementById('root')!;
 root.innerHTML='<div class="release-boot"><h1>Opening your Pocket…</h1><p>Your saved words and progress stay on this device.</p></div>';
 const catalog=await loadCatalog();
 const store=await openExperience(new ExperienceDB(),async()=>({backup:await exportBackup(db),sessions:await db.sessions.toArray(),hskSessions:await db.hskSessions.toArray()}),catalog);
 const config={production:true,version:'3.1.1',storageKey:'hanzi-pocket-v3',initialPayload:store.initial,offlineReady:false,offlineError:'',needsUpdate:false,reducedMotion:false,
  save:(payload:ExperiencePayload)=>store.save(payload),lookup:suggestions,
  async csv(state:Record<string,unknown>){const words=state.customWords as {id:string;h:string;p:string;m:string}[],saved=state.saved as string[],groups=state.groups as {id:string;name:string;createdAt:number;updatedAt:number}[],memberships=state.memberships as Record<string,string[]>;const all=[...words.map(w=>({id:w.id,hanzi:w.h,pinyin:w.p,meaning:w.m,normalized:w.h,createdAt:0,updatedAt:0})),...catalog].filter(w=>saved.includes(w.id));const data=exportCSV(all,groups,Object.entries(memberships).flatMap(([wordId,groupIds])=>groupIds.map(groupId=>({wordId,groupId}))));const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='hanzi-pocket.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  async importCSV(text:string,state:Record<string,unknown>){const records=parseCSV(text),copy=structuredClone(state),custom=copy.customWords as {id:string;h:string;p:string;m:string;source:string}[],saved=copy.saved as string[];for(const record of records){const existing=custom.find(w=>w.h===record.hanzi&&w.p===record.pinyin),entry=catalog.find(w=>w.hanzi===record.hanzi&&w.pinyin===record.pinyin&&w.meaning===record.meaning);let id=existing?.id??entry?.id;if(!id){id=crypto.randomUUID();custom.push({id,h:record.hanzi,p:record.pinyin,m:record.meaning,source:'personal'});}if(!saved.includes(id))saved.push(id);}await store.beforeImport();await store.save({format:'hanzi-pocket',version:3,state:copy});location.reload();},
  async backup(state:Record<string,unknown>){await store.flush();const value={format:'hanzi-pocket',version:3,exportedAt:Date.now(),state,originalRecords:await store.archive()};const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='hanzi-pocket-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  async restore(text:string){
   if(text.length>50_000_000)throw new Error('This backup is too large.');
   const value=JSON.parse(text);let payload:ExperiencePayload;
   if(value?.format==='hanzi-pocket'&&value.version===1){const backup=parseBackup(value);payload={format:'hanzi-pocket',version:3,state:migrateLegacy({backup,sessions:[],hskSessions:[]},catalog)};}
   else payload=validateExperience(value);
   await store.beforeImport();await store.save(payload);location.reload();
  },
  update:async()=>{await store.flush();await updateApp(true);}
 };
 config.reducedMotion=(await db.preferences.get('preferences'))?.reducedMotion??false;
 Object.assign(window,{HPAppConfig:config});
 const notify=()=>window.dispatchEvent(new Event('pocket-status'));
 const updateApp=registerSW({immediate:true,onOfflineReady(){config.offlineReady=true;notify();},onNeedRefresh(){config.needsUpdate=true;notify();},onRegisterError(error){config.offlineError=error instanceof Error?error.message:'Offline preparation failed. Reconnect and reopen the app.';notify();}});
 root.innerHTML='<div id="hp-stem-demo" aria-label="Hanzi Pocket"><div class="hp-phone" data-demo-app><main class="hp-main"><h1>Opening your Pocket…</h1></main></div></div>';
 for(const file of ['pocket-lucide.js','hanzi-writer.min.js','pocket-strokes.js','pocket-quiz.js','pocket-app.js'])await new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src=appAsset(file);script.onload=()=>resolve();script.onerror=()=>reject(new Error('Reconnect and reopen the app to finish downloading this update.'));document.head.append(script);});
 // Existing installations may not receive onOfflineReady again. Inspect one
 // complete cache rather than claiming readiness from registration alone.
 let tries=0;
 const verify=async()=>{try{for(const key of await caches.keys()){const cache=await caches.open(key);const paths=['index.html','dictionary.json','hsk-catalog.json','csca-catalog.json','pocket-app.js','pocket-quiz.js','pocket-strokes.js','pocket-lucide.js','hanzi-writer.min.js','pocket-style.css',...Array.from({length:16},(_,i)=>`strokes/${i}.json`)];if((await Promise.all(paths.map(path=>cache.match(appAsset(path),{ignoreSearch:true})))).every(Boolean)){config.offlineReady=true;notify();return;}}}catch{/* The registration error remains visible in Settings. */}if(++tries<30)setTimeout(()=>void verify(),10000);};
 if('serviceWorker'in navigator)void navigator.serviceWorker.ready.then(()=>verify());
}
void start().catch(error=>{
 const root=document.getElementById('root')!;root.replaceChildren();const box=document.createElement('div');box.className='release-boot';const heading=document.createElement('h1');heading.textContent='Your Pocket needs a moment.';const message=document.createElement('p');message.textContent=error instanceof Error?error.message:'The app could not open.';const note=document.createElement('p');note.textContent='Your existing words and progress have not been cleared.';const retry=document.createElement('button');retry.textContent='Reload app';retry.onclick=()=>location.reload();const previous=document.createElement('button');previous.textContent='Open previous interface';previous.onclick=()=>{root.replaceChildren();void import('./main');};box.append(heading,message,note,retry,previous);root.append(box);
});
