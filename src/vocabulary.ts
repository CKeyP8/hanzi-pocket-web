import type {PocketDB} from './db';
import {freshProgress,normalizedHanzi,type Word} from './model';

export interface WordInput {hanzi:string;pinyin:string;meaning:string;groupIds:string[]}
export function validateWord(input:WordInput){
  if(!normalizedHanzi(input.hanzi)||!input.pinyin.trim()||!input.meaning.trim())throw new Error('Please add characters, pinyin, and a meaning.');
  if(!/\p{Script=Han}/u.test(input.hanzi))throw new Error('The character field needs at least one Chinese character.');
  if(input.hanzi.length>100||input.pinyin.length>300||input.meaning.length>2000)throw new Error('This entry is too long. Please shorten it.');
}
export async function saveWord(database:PocketDB,input:WordInput,id?:string):Promise<string>{
  validateWord(input);const now=Date.now();const normalized=normalizedHanzi(input.hanzi);
  return database.transaction('rw',[database.words,database.progress,database.memberships,database.groups],async()=>{
    const duplicate=await database.words.where('normalized').equals(normalized).first();
    if(duplicate&&duplicate.id!==id)throw new Error('This word is already in your library. Open it to edit.');
    const old=id?await database.words.get(id):undefined;if(id&&!old)throw new Error('This word has been deleted.');
    const groupIds=[...new Set(input.groupIds)];
    if((await database.groups.bulkGet(groupIds)).some(g=>!g))throw new Error('A selected group no longer exists.');
    const word:Word={id:id??crypto.randomUUID(),hanzi:input.hanzi.trim(),normalized,pinyin:input.pinyin.trim(),meaning:input.meaning.trim(),createdAt:old?.createdAt??now,updatedAt:now};
    await database.words.put(word);if(!old)await database.progress.add(freshProgress(word.id,now));
    await database.memberships.where('wordId').equals(word.id).delete();
    await database.memberships.bulkAdd(groupIds.map(groupId=>({groupId,wordId:word.id})));
    return word.id;
  });
}
export async function deleteWord(database:PocketDB,id:string){
  await database.transaction('rw',[database.words,database.progress,database.memberships,database.reviews,database.sessions],async()=>{
    await database.words.delete(id);await database.progress.delete(id);await database.memberships.where('wordId').equals(id).delete();await database.reviews.where('wordId').equals(id).delete();
    const session=await database.sessions.get('active');if(session)await database.sessions.put({...session,queue:session.queue.filter(w=>w!==id),initialIds:session.initialIds.filter(w=>w!==id),history:[],revision:session.revision+1});
  });
}
export async function needsReview(database:PocketDB,id:string){
  await database.transaction('rw',database.progress,async()=>{const p=await database.progress.get(id);if(p)await database.progress.put({...p,dueAt:Date.now(),revision:p.revision+1});});
}
