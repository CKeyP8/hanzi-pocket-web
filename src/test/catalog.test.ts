import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {PocketDB} from '../db';
import {saveCatalogWord,type CatalogWord} from '../catalog';
import {saveWord} from '../vocabulary';
import {exportBackup,parseBackup,restoreBackup} from '../backup';
import {answerCard,startSession} from '../review/session';
import {defaultPreferences} from '../model';
import {saveGroup,assignWords} from '../groups';
const catalog=JSON.parse(readFileSync('public/hsk-catalog.json','utf8')) as CatalogWord[];
let db:PocketDB;
beforeEach(async()=>{db=new PocketDB(`catalog-${crypto.randomUUID()}`);await db.initialize();});
afterEach(async()=>{await db.delete();});
describe('Built-in HSK catalog',()=>{
  it('contains the examination syllabus levels 1–5 with stable unique IDs',()=>{
    expect(catalog).toHaveLength(3600);expect(new Set(catalog.map(w=>w.id)).size).toBe(3600);
    expect([1,2,3,4,5].map(level=>catalog.filter(w=>w.level===level).length)).toEqual([300,200,500,1000,1600]);
    for(const word of catalog){expect(word.pinyin.trim()).not.toBe('');expect(word.meaning.trim()).not.toBe('');expect(word.hanzi).not.toMatch(/[0-9]$/);}
  });
  it('enrolls only the saved word, with fresh progress and no review',async()=>{
    expect(await db.words.count()).toBe(0);const id=await saveCatalogWord(db,catalog[0]);
    expect(await db.words.count()).toBe(1);expect(await db.progress.count()).toBe(1);expect(await db.reviews.count()).toBe(0);expect((await db.progress.get(id))?.lastReviewedAt).toBeNull();
  });
  it('preserves an existing custom definition, learning history, memberships and session',async()=>{
    const word=catalog[0];const id=await saveWord(db,{hanzi:word.hanzi,pinyin:'my pronunciation',meaning:'My own meaning',groupIds:[]});
    const group=await saveGroup(db,'Personal');await assignWords(db,[id],group);const session=await startSession(db,defaultPreferences);await answerCard(db,session,true);
    const before=await exportBackup(db),active=await db.sessions.get('active');expect(await saveCatalogWord(db,word)).toBe(id);
    const after=await exportBackup(db);expect(after.words).toEqual(before.words);expect(after.progress).toEqual(before.progress);expect(after.reviews).toEqual(before.reviews);expect(after.memberships).toEqual(before.memberships);expect(await db.sessions.get('active')).toEqual(active);
  });
  it('makes concurrent saves idempotent',async()=>{const [a,b]=await Promise.all([saveCatalogWord(db,catalog[0]),saveCatalogWord(db,catalog[0])]);expect(a).toBe(b);expect(await db.words.count()).toBe(1);});
  it('retains compatibility with version-1 JSON backups',async()=>{await saveCatalogWord(db,catalog[0]);const backup=parseBackup(JSON.stringify(await exportBackup(db)));await restoreBackup(db,backup,'replace');expect(await db.words.count()).toBe(1);expect(await db.progress.count()).toBe(1);expect(backup.version).toBe(1);});
  it('bundles valid stroke paths and medians for every catalog character',()=>{
    const characters=new Set(catalog.flatMap(w=>[...w.hanzi]));const index=JSON.parse(readFileSync('public/strokes/index.json','utf8'));
    const shards=Array.from({length:16},(_,i)=>JSON.parse(readFileSync(`public/strokes/${i}.json`,'utf8')));
    for(const char of characters){expect(index.characters).toContain(char);const data=shards[char.codePointAt(0)!%16][char];expect(data.strokes.length).toBeGreaterThan(0);expect(data.medians.length).toBe(data.strokes.length);}
  });
});
