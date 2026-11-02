import type {PocketDB} from './db';
import {normalizedHanzi,defaultPreferences,freshProgress,type Word,type Group,type Progress,type Review,type Membership,type Preferences,type HSKProgress} from './model';
import {validateWord,saveWord} from './vocabulary';
import {isNative,shareNativeFile} from './speech';

export interface Backup {format:'hanzi-pocket';version:1;exportedAt:number;words:Word[];groups:Group[];memberships:Membership[];progress:Progress[];reviews:Review[];preferences:Preferences;hsk?:{progress:HSKProgress[];lastLevel:number|null}}
const fail=()=>{throw new Error('This backup is invalid or uses an unsupported format. Nothing was changed.');};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max=2000):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const num=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const integer=(value:unknown):value is number=>num(value)&&Number.isInteger(value);
const id=(value:unknown):value is string=>text(value,128);
export function validatePreferences(value:unknown):Preferences{
  if(!object(value)||value.id!=='preferences'||!integer(value.newPerDay)||value.newPerDay>500||!integer(value.sessionSize)||value.sessionSize<1||value.sessionSize>500||!['scheduled','random'].includes(String(value.mode))||!['light','dark','system'].includes(String(value.appearance))||![3,4,5].includes(Number(value.columns))||typeof value.sound!=='boolean'||typeof value.reducedMotion!=='boolean'||typeof value.onboarded!=='boolean'||!(value.groupId===null||id(value.groupId))||!(value.lastBackupAt===null||num(value.lastBackupAt)))return fail();
  return value as unknown as Preferences;
}
function validProgress(value:unknown):value is Progress{
  return object(value)&&id(value.wordId)&&integer(value.streak)&&integer(value.correct)&&integer(value.incorrect)&&num(value.dueAt)&&num(value.intervalDays)&&integer(value.revision)&&(value.lastReviewedAt===null||num(value.lastReviewedAt));
}
function unique(records:Record<string,unknown>[],key:string){const seen=new Set();for(const record of records){if(seen.has(record[key]))fail();seen.add(record[key]);}}
export function parseBackup(input:string|unknown):Backup{
  let data:unknown=input;if(typeof input==='string'){if(input.length>50_000_000)throw new Error('This file is too large. Maximum backup size is 50 MB.');try{data=JSON.parse(input);}catch{return fail();}}
  if(!object(data)||data.format!=='hanzi-pocket'||data.version!==1||!num(data.exportedAt))return fail();
  for(const key of ['words','groups','memberships','progress','reviews'])if(!Array.isArray(data[key])||data[key].length>500000)return fail();
  const result=data as unknown as Backup;
  const normalized=new Set<string>();
  for(const w of result.words){if(!object(w)||!id(w.id)||!text(w.hanzi,100)||!text(w.pinyin,300)||!text(w.meaning,2000)||!num(w.createdAt)||!num(w.updatedAt)||w.normalized!==normalizedHanzi(w.hanzi))return fail();validateWord({...w,groupIds:[]});if(normalized.has(w.normalized))return fail();normalized.add(w.normalized);}
  for(const g of result.groups)if(!object(g)||!id(g.id)||!text(g.name,80)||!num(g.createdAt)||!num(g.updatedAt))return fail();
  unique(result.words as unknown as Record<string,unknown>[],'id');unique(result.groups as unknown as Record<string,unknown>[],'id');
  const words=new Set(result.words.map(w=>w.id)),groups=new Set(result.groups.map(g=>g.id));
  const joins=new Set();for(const m of result.memberships){if(!object(m)||!words.has(m.wordId)||!groups.has(m.groupId))return fail();const key=JSON.stringify([m.wordId,m.groupId]);if(joins.has(key))return fail();joins.add(key);}
  for(const p of result.progress)if(!validProgress(p)||!words.has(p.wordId))return fail();
  unique(result.progress as unknown as Record<string,unknown>[],'wordId');if(result.progress.length!==result.words.length)return fail();
  for(const r of result.reviews)if(!object(r)||!id(r.id)||!id(r.sessionId)||!words.has(r.wordId)||!num(r.at)||typeof r.correct!=='boolean'||!validProgress(r.previous)||!validProgress(r.next)||r.previous.wordId!==r.wordId||r.next.wordId!==r.wordId)return fail();
  unique(result.reviews as unknown as Record<string,unknown>[],'id');validatePreferences(result.preferences);
  if(result.hsk!==undefined){
    const hsk=result.hsk;
    if(!object(hsk)||!Array.isArray(hsk.progress)||hsk.progress.length>10000||!(hsk.lastLevel===null||(integer(hsk.lastLevel)&&hsk.lastLevel>=1&&hsk.lastLevel<=5)))return fail();
    for(const p of hsk.progress)if(!object(p)||!id(p.wordId)||!integer(p.level)||p.level<1||p.level>5||!integer(p.attempts)||p.attempts<1||!integer(p.correct)||!integer(p.incorrect)||p.attempts!==p.correct+p.incorrect||typeof p.lastCorrect!=='boolean'||!num(p.lastSeenAt)||!integer(p.revision)||p.revision<1)return fail();
    unique(hsk.progress as unknown as Record<string,unknown>[],'wordId');
  }
  if(result.preferences.groupId!==null&&!groups.has(result.preferences.groupId))return fail();return result;
}
export async function exportBackup(database:PocketDB):Promise<Backup>{
  return database.transaction('r',[database.words,database.groups,database.memberships,database.progress,database.reviews,database.preferences,database.hskProgress,database.studyState],async()=>({format:'hanzi-pocket',version:1,exportedAt:Date.now(),words:await database.words.toArray(),groups:await database.groups.toArray(),memberships:await database.memberships.toArray(),progress:await database.progress.toArray(),reviews:await database.reviews.toArray(),preferences:(await database.preferences.get('preferences'))??{...defaultPreferences},hsk:{progress:await database.hskProgress.toArray(),lastLevel:(await database.studyState.get('hsk'))?.lastLevel??null}}));
}
export async function restoreBackup(database:PocketDB,input:Backup,mode:'merge'|'replace'){
  const data=parseBackup(input);
  return database.transaction('rw',[database.words,database.groups,database.memberships,database.progress,database.reviews,database.preferences,database.sessions,database.hskProgress,database.hskSessions,database.studyState],async()=>{
    if(data.hsk){
      if(mode==='replace'){
        await database.hskProgress.clear();await database.hskSessions.clear();await database.studyState.clear();
        await database.hskProgress.bulkPut(data.hsk.progress);
      }else{
        const existing=new Set((await database.hskProgress.toArray()).map(p=>p.wordId));
        const added=data.hsk.progress.filter(p=>!existing.has(p.wordId));await database.hskProgress.bulkAdd(added);
        if(added.length)await database.hskSessions.clear();
      }
      if(data.hsk.lastLevel!==null&&(mode==='replace'||!await database.studyState.get('hsk')))await database.studyState.put({id:'hsk',lastLevel:data.hsk.lastLevel});
    }
    if(mode==='replace'){
      await Promise.all([database.words.clear(),database.groups.clear(),database.memberships.clear(),database.progress.clear(),database.reviews.clear(),database.sessions.clear(),database.preferences.clear()]);
      await database.words.bulkAdd(data.words);await database.groups.bulkAdd(data.groups);await database.memberships.bulkAdd(data.memberships);await database.progress.bulkAdd(data.progress);await database.reviews.bulkAdd(data.reviews);await database.preferences.put({...data.preferences,onboarded:true});return {added:data.words.length,kept:0};
    }
    const existingWords=await database.words.toArray(),existingGroups=await database.groups.toArray();
    const wordMap=new Map<string,string>(),groupMap=new Map<string,string>(),newIds=new Set<string>();
    let added=0,kept=0;
    for(const w of data.words){const duplicate=existingWords.find(old=>old.normalized===w.normalized);if(duplicate){wordMap.set(w.id,duplicate.id);kept++;continue;}const id=existingWords.some(old=>old.id===w.id)?crypto.randomUUID():w.id;wordMap.set(w.id,id);newIds.add(w.id);await database.words.add({...w,id});existingWords.push({...w,id});added++;}
    for(const g of data.groups){const old=existingGroups.find(old=>old.name===g.name);const id=old?.id??(existingGroups.some(old=>old.id===g.id)?crypto.randomUUID():g.id);groupMap.set(g.id,id);if(!old){await database.groups.add({...g,id});existingGroups.push({...g,id});}}
    await database.memberships.bulkPut(data.memberships.map(m=>({wordId:wordMap.get(m.wordId)!,groupId:groupMap.get(m.groupId)!})));
    await database.progress.bulkAdd(data.progress.filter(p=>newIds.has(p.wordId)).map(p=>({...p,wordId:wordMap.get(p.wordId)!})));
    for(const r of data.reviews.filter(r=>newIds.has(r.wordId))){const wordId=wordMap.get(r.wordId)!;const id=await database.reviews.get(r.id)?crypto.randomUUID():r.id;await database.reviews.add({...r,id,wordId,previous:{...r.previous,wordId},next:{...r.next,wordId}});}
    return {added,kept};
  });
}
const csvCell=(value:string)=>`"${value.replaceAll('"','""')}"`;
export function exportCSV(words:Word[],groups:Group[],memberships:Membership[]){
  const rows=[['Characters','Pinyin','Meaning','Groups'],...words.map(w=>[w.hanzi,w.pinyin,w.meaning,groups.filter(g=>memberships.some(m=>m.wordId===w.id&&m.groupId===g.id)).map(g=>g.name).join(' | ')])];
  // Prefix spreadsheet formula triggers so exported user text stays inert in Excel.
  return '\uFEFF'+rows.map(row=>row.map(value=>csvCell(/^[=+@-]/.test(value)?"'"+value:value)).join(',')).join('\r\n');
}
export function parseCSV(input:string):{hanzi:string;pinyin:string;meaning:string}[]{
  if(input.length>50_000_000)throw new Error('This file is too large.');
  input=input.replace(/^\uFEFF/,'');
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<input.length;i++){const char=input[i];if(char==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else throw new Error('Invalid CSV quoting.');}else if(char===','&&!quoted){row.push(cell);cell='';}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(s=>s.trim()))rows.push(row);row=[];cell='';}else cell+=char;}
  if(quoted)throw new Error('The CSV contains an unfinished quoted field.');row.push(cell);if(row.some(s=>s.trim()))rows.push(row);
  const header=rows.shift()?.map(s=>s.replace(/^\uFEFF/,'').trim().toLowerCase());if(!header)throw new Error('This CSV is empty.');
  const columns=['characters','pinyin','meaning'].map(name=>header.indexOf(name));if(columns.some(i=>i<0))throw new Error('CSV needs Characters, Pinyin, and Meaning columns.');
  return rows.map(row=>{const values=columns.map(i=>(row[i]??'').replace(/^'(?=[=+@-])/,'').trim());const word={hanzi:values[0],pinyin:values[1],meaning:values[2]};validateWord({...word,groupIds:[]});return word;});
}
export async function importCSV(database:PocketDB,records:ReturnType<typeof parseCSV>){
  let added=0,skipped=0;
  await database.transaction('rw',[database.words,database.progress,database.memberships,database.groups],async()=>{for(const record of records){if(await database.words.where('normalized').equals(normalizedHanzi(record.hanzi)).count()){skipped++;continue;}await saveWord(database,{...record,groupIds:[]});added++;}});return {added,skipped};
}
export async function downloadFile(contents:string,name:string,type:string){
  if(isNative())return (await shareNativeFile(contents,name)).completed;
  const blob=new Blob([contents],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  return true;
}
