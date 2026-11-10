import {afterEach,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {PocketDB} from '../db';
import {exportBackup} from '../backup';
import {saveWord} from '../vocabulary';
import {saveGroup,assignWords} from '../groups';
import {ExperienceDB,migrateLegacy,openExperience,validateExperience,type LegacySnapshot,type ExperiencePayload} from '../experience-storage';
import type {CatalogWord} from '../catalog';

const catalog:CatalogWord[]=JSON.parse(readFileSync('public/hsk-catalog.json','utf8'));
const databases:(ExperienceDB|PocketDB)[]=[];
afterEach(async()=>{for(const db of databases)await db.delete();databases.length=0;});
async function fixture(){
 const db=new PocketDB('test-legacy-'+crypto.randomUUID());databases.push(db);await db.initialize();
 const word=catalog[0],id=await saveWord(db,{hanzi:word.hanzi,pinyin:word.pinyin,meaning:word.meaning,groupIds:[]});
 const personal=await saveWord(db,{hanzi:'量子计算',pinyin:'liàngzǐ jìsuàn',meaning:'my edited course definition',groupIds:[]});
 const group=await saveGroup(db,'My course');await assignWords(db,[id,personal],group);
 await db.progress.update(id,{correct:2,incorrect:1,streak:0,lastReviewedAt:200,revision:3});
 await db.hskProgress.put({wordId:word.id,level:1,attempts:4,correct:3,incorrect:1,lastCorrect:true,lastSeenAt:100,revision:4});
 await db.hskSessions.put({level:1,token:'hsk',scopeIds:catalog.filter(w=>w.level===1).map(w=>w.id),queue:[catalog[1].id,catalog[2].id],history:[],revision:0});
 await db.studyState.put({id:'hsk',lastLevel:4});
 await db.sessions.put({id:'active',token:'pocket',queue:[personal,id],initialIds:[id,personal],history:[],startedAt:1,groupId:null,mode:'random',revision:0});
 const snapshot:LegacySnapshot={backup:await exportBackup(db),sessions:await db.sessions.toArray(),hskSessions:await db.hskSessions.toArray()};
 return {db,snapshot,id,personal,group};
}
function create(){const db=new ExperienceDB('test-experience-'+crypto.randomUUID());databases.push(db);return db;}
describe('Approved experience migration',()=>{
 it('retains vocabulary, edits, groups, latest results, counters and remaining queues',async()=>{
  const {snapshot,personal,group}=await fixture(),s=migrateLegacy(snapshot,catalog) as any;
  expect(s.saved).toEqual([catalog[0].id,'legacy-'+personal]);expect(s.customWords[0].m).toBe('my edited course definition');
  expect(s.memberships[catalog[0].id]).toEqual([group]);expect(s.memberships['legacy-'+personal]).toEqual([group]);
  expect(s.progress['hsk:normal:'+catalog[0].id]).toMatchObject({attempts:7,correct:false,lastSeenAt:200});
  expect(s.progress['hsk:normal:'+catalog[0].id].legacyPocketProgress).toEqual(snapshot.backup.progress.find(p=>p.lastReviewedAt!==null));
  expect(s.queues['hsk-1:normal']).toEqual([catalog[1].id,catalog[2].id]);expect(s.queues['pocket:normal:all:all']).toEqual(['legacy-'+personal,catalog[0].id]);expect(s.lastHskLevel).toBe(4);
  expect(validateExperience({format:'hanzi-pocket',version:3,state:s}).state).toEqual(s);
 });
 it('archives originals atomically and retries without overwriting new progress',async()=>{
  const {db:old,snapshot}=await fixture(),next=create(),before=await exportBackup(old),read=vi.fn(async()=>snapshot);
  const a=await openExperience(next,read,catalog),state={...a.initial.state,lastHskLevel:5};
  await a.save({format:'hanzi-pocket',version:3,state});const b=await openExperience(next,read,catalog);
  expect(read).toHaveBeenCalledTimes(1);expect(b.initial.state.lastHskLevel).toBe(5);expect(await b.archive()).toEqual(snapshot);
  const after=await exportBackup(old);expect({...after,exportedAt:0}).toEqual({...before,exportedAt:0});
 });
 it('serialises rapid writes and rejects a stale second window',async()=>{
  const {snapshot}=await fixture(),next=create(),a=await openExperience(next,async()=>snapshot,catalog),b=await openExperience(next,async()=>snapshot,catalog);
  const values=[1,2,3].map(lastHskLevel=>({...a.initial,state:{...a.initial.state,lastHskLevel}}));await Promise.all(values.map(v=>a.save(v)));
  await expect(b.save({...b.initial,state:{...b.initial.state,lastHskLevel:1}})).rejects.toThrow('another window');
  expect((await next.state.get('active'))?.payload.state.lastHskLevel).toBe(3);
 });
 it('keeps a recovery copy before a JSON restore and validates exports',async()=>{
  const {snapshot}=await fixture(),next=create(),a=await openExperience(next,async()=>snapshot,catalog);await a.beforeImport();
  expect(await next.archives.count()).toBe(2);expect(validateExperience(a.initial)).toEqual(a.initial);
  expect(()=>validateExperience({...a.initial,state:{...a.initial.state,groups:[{id:'x',name:42}]}})).toThrow('invalid collection');
  expect(()=>validateExperience({...a.initial,state:{...a.initial.state,progress:{bad:{attempts:1,correct:'false'}}}})).toThrow('learning progress');
 });
 it('does not leave partial migration state when the archive cannot be saved',async()=>{
  const {snapshot}=await fixture(),next=create();await next.open();const original=next.archives.add.bind(next.archives);
  vi.spyOn(next.archives,'add').mockRejectedValueOnce(new Error('Storage full'));
  await expect(openExperience(next,async()=>snapshot,catalog)).rejects.toThrow('Storage full');expect(await next.state.count()).toBe(0);
  next.archives.add=original;expect((await openExperience(next,async()=>snapshot,catalog)).initial.state.saved).toHaveLength(2);
 });
});
