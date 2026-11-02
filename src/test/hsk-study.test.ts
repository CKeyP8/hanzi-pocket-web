import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import Dexie from 'dexie';
import {readFileSync} from 'node:fs';
import {PocketDB} from '../db';
import {startHSKSession,answerHSKCard,undoHSKAnswer,hskStats} from '../hsk-study';
import {saveCatalogWord,type CatalogWord} from '../catalog';
import {startSession,answerCard,undoAnswer} from '../review/session';
import {defaultPreferences,freshProgress} from '../model';
import {exportBackup,parseBackup,restoreBackup} from '../backup';
const catalog=JSON.parse(readFileSync('public/hsk-catalog.json','utf8')) as CatalogWord[];
const words=catalog.filter(w=>w.level===1).slice(0,8);
let db:PocketDB;
beforeEach(async()=>{db=new PocketDB(`hsk-study-${crypto.randomUUID()}`);await db.initialize();});
afterEach(async()=>{await db.delete();});

describe('Persistent HSK learning',()=>{
  it('resumes unseen and missed words after database close/reopen, before correct words',async()=>{
    let s=await startHSKSession(db,words,1);const correct=s.queue[0];await answerHSKCard(db,s,words,true,100);
    s=(await db.hskSessions.get(1))!;const missed=s.queue[0];await answerHSKCard(db,s,words,false,200);
    const queue=(await db.hskSessions.get(1))!.queue,name=db.name;db.close();db=new PocketDB(name);
    s=await startHSKSession(db,words,1);expect(s.queue).toEqual(queue);expect(s.queue).not.toContain(correct);expect(s.queue).toContain(missed);
    expect(hskStats(words,await db.hskProgress.toArray())).toEqual({seen:2,unseen:6,missed:1});
    expect(await db.words.count()).toBe(0);expect(await db.reviews.count()).toBe(0);
  });
  it('keeps all five levels independent and remembers the actual last practiced level',async()=>{
    for(let level=1;level<=5;level++){
      const scope=catalog.filter(w=>w.level===level).slice(0,3),s=await startHSKSession(db,scope,level);
      await answerHSKCard(db,s,scope,level%2===0,level*100);
    }
    for(let level=1;level<=5;level++)expect(await db.hskProgress.where('level').equals(level).count()).toBe(1);
    expect((await db.studyState.get('hsk'))?.lastLevel).toBe(5);
    await startHSKSession(db,words,1);expect((await db.studyState.get('hsk'))?.lastLevel).toBe(1);
  });
  it('shows familiar words only after unseen/missed words clear and continues without a cutoff',async()=>{
    let s=await startHSKSession(db,words,1);const seen=new Set<string>();
    for(let i=0;i<words.length;i++){seen.add(s.queue[0]);await answerHSKCard(db,s,words,true,100+i);s=(await db.hskSessions.get(1))!;}
    expect(seen.size).toBe(words.length);expect(s.queue).toHaveLength(words.length);
    expect(hskStats(words,await db.hskProgress.toArray())).toEqual({seen:8,unseen:0,missed:0});
    const missed=s.queue[0];await answerHSKCard(db,s,words,false,200);s=await startHSKSession(db,words,1);
    expect(s.queue).toEqual([missed]);await answerHSKCard(db,s,words,true,201);s=(await db.hskSessions.get(1))!;
    expect(s.queue).toHaveLength(8);expect(s.queue[0]).not.toBe(missed);
  });
  it('restores seen status, last answer and exact queue with Undo',async()=>{
    const s=await startHSKSession(db,words,1);await answerHSKCard(db,s,words,false,100);
    await undoHSKAnswer(db,(await db.hskSessions.get(1))!);expect(await db.hskProgress.count()).toBe(0);expect((await db.hskSessions.get(1))?.queue).toEqual(s.queue);
    const current=(await db.hskSessions.get(1))!;await answerHSKCard(db,current,words,true,200);const before=await db.hskProgress.get(s.queue[0]);
    await startHSKSession(db,[words.find(w=>w.id===s.queue[0])!],1);await answerHSKCard(db,(await db.hskSessions.get(1))!,[words.find(w=>w.id===s.queue[0])!],false,300);
    await undoHSKAnswer(db,(await db.hskSessions.get(1))!);expect(await db.hskProgress.get(s.queue[0])).toEqual(before);
  });
  it('rejects stale and duplicate HSK answers without partial progress',async()=>{
    const s=await startHSKSession(db,words,1),results=await Promise.allSettled([answerHSKCard(db,s,words,true),answerHSKCard(db,s,words,false)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await db.hskProgress.count()).toBe(1);
    await startHSKSession(db,words,1);await expect(answerHSKCard(db,(await Promise.resolve(s)),words,true)).rejects.toThrow('another window');
  });
  it('reconciles a filtered practice set when returning to the full level',async()=>{
    const subset=words.slice(0,2),s=await startHSKSession(db,subset,1),first=s.queue[0];await answerHSKCard(db,s,subset,true);
    const full=await startHSKSession(db,words,1);expect(full.queue).toHaveLength(7);expect(full.queue).not.toContain(first);
  });
});

describe('Pocket order and HSK handoff',()=>{
  it('varies repeated Pocket passes even when the random source repeats',async()=>{
    for(const word of words.slice(0,3))await saveCatalogWord(db,word);
    const a=await startSession(db,defaultPreferences,()=>0),b=await startSession(db,defaultPreferences,()=>0);
    expect(new Set(b.queue)).toEqual(new Set(a.queue));expect(b.queue).not.toEqual(a.queue);
  });
  it('hands off after one pass, including misses, and resumes the last HSK queue',async()=>{
    let hsk=await startHSKSession(db,words,1);const done=hsk.queue[0];await answerHSKCard(db,hsk,words,true);
    const expected=(await db.hskSessions.get(1))!.queue;
    for(const word of words.slice(0,3))await saveCatalogWord(db,word);
    let pocket=await startSession(db,defaultPreferences);const seen=new Set<string>();
    for(let i=0;i<3;i++){seen.add(pocket.queue[0]);expect(await answerCard(db,pocket,i!==0)).toBe(i===2?1:null);pocket=(await db.sessions.get('active'))!;}
    expect(seen.size).toBe(3);expect(pocket.queue).toEqual([]);expect(pocket.handoffLevel).toBe(1);
    hsk=await startHSKSession(db,words,pocket.handoffLevel!);expect(hsk.queue).toEqual(expected);expect(hsk.queue).not.toContain(done);
    await undoAnswer(db,pocket);expect((await db.sessions.get('active'))?.queue).toHaveLength(1);expect(await db.reviews.count()).toBe(2);
  });
});

describe('Non-destructive storage and backup expansion',()=>{
  it('upgrades a real version-1 database without changing personal records',async()=>{
    const name=`legacy-${crypto.randomUUID()}`,old=new Dexie(name);
    old.version(1).stores({words:'id,&normalized,createdAt,pinyin',groups:'id,name',memberships:'[wordId+groupId],wordId,groupId',progress:'wordId,dueAt',reviews:'id,wordId,at,sessionId',sessions:'id',preferences:'id'});
    await old.open();const word={...words[0],id:'personal'},progress=freshProgress('personal',100),group={id:'lesson',name:'My lesson',createdAt:100,updatedAt:100};
    const records={words:[word],progress:[progress],groups:[group],memberships:[{wordId:word.id,groupId:group.id}],preferences:[{...defaultPreferences,onboarded:true}],sessions:[{id:'active',token:'existing',queue:[word.id],initialIds:[word.id],history:[],startedAt:100,groupId:group.id,mode:'scheduled',revision:0}],reviews:[]};
    for(const [table,rows] of Object.entries(records))await old.table(table).bulkPut(rows);old.close();
    const upgraded=new PocketDB(name);await upgraded.initialize();for(const [table,rows] of Object.entries(records))expect(await upgraded.table(table).toArray()).toEqual(rows);
    expect(await upgraded.hskProgress.count()).toBe(0);await upgraded.delete();
  });
  it('exports/restores HSK learning and the last level with the existing JSON format',async()=>{
    const s=await startHSKSession(db,words,1);await answerHSKCard(db,s,words,false,100);const backup=parseBackup(JSON.stringify(await exportBackup(db)));
    expect(backup.version).toBe(1);expect(backup.hsk?.progress).toHaveLength(1);await db.hskProgress.clear();await restoreBackup(db,backup,'replace');
    expect(await db.hskProgress.toArray()).toEqual(backup.hsk!.progress);expect((await db.studyState.get('hsk'))?.lastLevel).toBe(1);expect(await db.hskSessions.count()).toBe(0);
  });
  it('merges HSK entries without overwriting local answers and accepts old backups',async()=>{
    let s=await startHSKSession(db,words,1);await answerHSKCard(db,s,words,false,100);const backup=await exportBackup(db),first=s.queue[0];
    s=await startHSKSession(db,[words.find(w=>w.id===first)!],1);await answerHSKCard(db,s,[words.find(w=>w.id===first)!],true,200);const local=await db.hskProgress.get(first);
    await restoreBackup(db,backup,'merge');expect(await db.hskProgress.get(first)).toEqual(local);
    const legacy={...backup};delete legacy.hsk;await restoreBackup(db,parseBackup(legacy),'replace');expect(await db.hskProgress.get(first)).toEqual(local);
    const malformed={...backup,hsk:{...backup.hsk,progress:[{...backup.hsk!.progress[0],level:9}]}};expect(()=>parseBackup(malformed)).toThrow('invalid');
  });
});
