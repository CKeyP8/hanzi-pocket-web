import Dexie,{type EntityTable} from 'dexie';
import type {Backup} from './backup';
import type {HSKSession,Session} from './model';
import type {CatalogWord} from './catalog';

export type ExperienceState=Record<string,unknown>;
export interface ExperiencePayload {format:'hanzi-pocket';version:3;state:ExperienceState}
interface Active {id:'active';revision:number;payload:ExperiencePayload}
export interface LegacySnapshot {backup:Backup;sessions:Session[];hskSessions:HSKSession[]}
export class ExperienceDB extends Dexie {
  state!:EntityTable<Active,'id'>;
  archives!:EntityTable<{id:string;value:unknown},'id'>;
  constructor(name=`hanzi-pocket-v3:${import.meta.env.BASE_URL}`){super(name);this.version(1).stores({state:'id',archives:'id'});}
}

// Original records stay in their original database and in an immutable archive.
// The approved experience uses a separate store; migration never clears a table.
export function migrateLegacy(snapshot:LegacySnapshot,catalog:CatalogWord[]):ExperienceState{
  const {backup,sessions,hskSessions}=snapshot;
  const words=new Map(catalog.map(w=>[w.hanzi,w])),ids=new Set(catalog.map(w=>w.id)),mapped=new Map<string,string>();
  const saved:string[]=[],customWords:Record<string,unknown>[]=[],progress:Record<string,Record<string,unknown>>={},queues:Record<string,string[]>={},source=new Map<string,string>();
  for(const w of backup.words){
    const match=words.get(w.hanzi),same=match&&match.pinyin===w.pinyin&&match.meaning===w.meaning;
    const id=same?match.id:`legacy-${w.id}`;mapped.set(w.id,id);saved.push(id);source.set(id,same?'hsk':'personal');
    if(!same)customWords.push({id,h:w.hanzi,p:w.pinyin,m:w.meaning,source:'personal',legacyWord:w});
  }
  for(const p of backup.hsk?.progress??[]){if(ids.has(p.wordId))progress[`hsk:normal:${p.wordId}`]={attempts:p.attempts,correct:p.lastCorrect,lastSeenAt:p.lastSeenAt,legacyHskProgress:p};}
  for(const p of backup.progress){
    const id=mapped.get(p.wordId);if(!id||p.lastReviewedAt===null)continue;
    const key=`${source.get(id)}:normal:${id}`,other=progress[key];
    progress[key]={...other,attempts:(Number(other?.attempts)||0)+p.correct+p.incorrect,correct:other&&Number(other.lastSeenAt)>p.lastReviewedAt?other.correct:p.streak>0,lastSeenAt:Math.max(Number(other?.lastSeenAt)||0,p.lastReviewedAt),legacyPocketProgress:p};
  }
  for(const s of hskSessions)queues[`hsk-${s.level}:normal`]=[...new Set(s.queue.filter(id=>ids.has(id)))];
  const active=sessions.find(s=>s.id==='active');if(active)queues['pocket:normal:all:all']=[...new Set(active.queue.map(id=>mapped.get(id)).filter((id):id is string=>!!id))];
  const memberships:Record<string,string[]>={};for(const join of backup.memberships){const id=mapped.get(join.wordId);if(id)memberships[id]=[...new Set([...(memberships[id]??[]),join.groupId])];}
  return {panel:'review',mode:'normal',saved:[...new Set(saved)],customWords,groups:backup.groups,memberships,progress,queues,lastHskLevel:backup.hsk?.lastLevel??1,history:[]};
}

export async function openExperience(database:ExperienceDB,readLegacy:()=>Promise<LegacySnapshot>,catalog:CatalogWord[]){
  let active=await database.state.get('active');
  if(!active){
    const snapshot=await readLegacy(),state=migrateLegacy(snapshot,catalog);
    await database.transaction('rw',database.state,database.archives,async()=>{
      if(await database.state.get('active'))return;
      await database.archives.add({id:'before-v3',value:snapshot});
      await database.state.add({id:'active',revision:1,payload:{format:'hanzi-pocket',version:3,state}});
    });
    active=(await database.state.get('active'))!;
  }
  let revision=active.revision,tail=Promise.resolve();
  const save=(payload:ExperiencePayload)=>{
    const copy=structuredClone(payload);
    const work=tail.then(()=>database.transaction('rw',database.state,async()=>{
      const current=await database.state.get('active');
      if(current?.revision!==revision)throw new Error('Your Pocket changed in another window. Reload this app before continuing.');
      await database.state.put({id:'active',revision:revision+1,payload:copy});revision++;
    }));
    tail=work.catch(()=>{});return work;
  };
  return {initial:active.payload,save,flush:()=>tail,async archive(){return (await database.archives.get('before-v3'))?.value;},async beforeImport(){await tail;const current=await database.state.get('active');if(current)await database.archives.put({id:`before-import-${Date.now()}`,value:current});}};
}

export function validateExperience(value:unknown):ExperiencePayload{
  if(!value||typeof value!=='object')throw new Error('Choose a Hanzi Pocket JSON backup.');
  const raw=value as Record<string,unknown>,s=raw.state as Record<string,unknown>|undefined;
  if(!['hanzi-pocket','hanzi-pocket-preview'].includes(String(raw.format))||![2,3].includes(Number(raw.version))||!s||typeof s!=='object'||Array.isArray(s))throw new Error('This backup format is not supported. Nothing was changed.');
  for(const field of ['saved','customWords','groups'])if(!Array.isArray(s[field])||(s[field] as unknown[]).length>500000)throw new Error('The backup is incomplete. Nothing was changed.');
  if(!(s.saved as unknown[]).every(v=>typeof v==='string'))throw new Error('The backup contains invalid word IDs.');
  for(const w of s.customWords as Record<string,unknown>[])if(!w||!['id','h','p','m'].every(k=>typeof w[k]==='string'&&(w[k] as string).length<=4000))throw new Error('The backup contains an invalid personal word.');
  for(const g of s.groups as Record<string,unknown>[])if(!g||typeof g.id!=='string'||typeof g.name!=='string'||g.name.length>80)throw new Error('The backup contains an invalid collection.');
  for(const field of ['progress','queues','memberships'])if(!s[field]||typeof s[field]!=='object'||Array.isArray(s[field]))throw new Error('The backup has invalid progress or collections.');
  for(const values of Object.values(s.memberships as object))if(!Array.isArray(values)||!values.every(v=>typeof v==='string'))throw new Error('The backup contains invalid memberships.');
  for(const values of Object.values(s.queues as object))if(!Array.isArray(values)||!values.every(v=>typeof v==='string'))throw new Error('The backup contains an invalid review queue.');
  for(const record of Object.values(s.progress as object))if(!record||typeof record!=='object'||typeof record.correct!=='boolean'||!Number.isInteger(record.attempts)||record.attempts<1)throw new Error('The backup contains invalid learning progress.');
  return {format:'hanzi-pocket',version:3,state:s};
}
