import type {PocketDB} from '../db';
import type {Preferences,Session,Review} from '../model';
import {chooseCards,schedule,shuffle} from './scheduler';

export async function startSession(database:PocketDB,prefs:Preferences,random=Math.random){
  return database.transaction('rw',[database.words,database.progress,database.reviews,database.memberships,database.sessions],async()=>{
    let words=await database.words.toArray();if(prefs.groupId){const ids=new Set((await database.memberships.where('groupId').equals(prefs.groupId).toArray()).map(m=>m.wordId));words=words.filter(w=>ids.has(w.id));}
    const old=await database.sessions.get('active');
    const ids=shuffle(chooseCards(words,await database.progress.toArray(),await database.reviews.toArray(),prefs),random);
    if(ids.length>1&&old?.initialIds.length===ids.length&&ids.every((id,i)=>id===old.initialIds[i]))ids.push(ids.shift()!);
    const session:Session={id:'active',token:crypto.randomUUID(),queue:ids,initialIds:ids,history:[],startedAt:Date.now(),groupId:prefs.groupId,mode:'random',revision:0};
    await database.sessions.put(session);return session;
  });
}
export async function answerCard(database:PocketDB,session:Session,correct:boolean,now=Date.now()){
  return database.transaction('rw',[database.sessions,database.words,database.memberships,database.progress,database.reviews,database.studyState],async()=>{
    const active=await database.sessions.get('active');if(!active||active.token!==session.token||active.revision!==session.revision)throw new Error('This session changed in another window. Please try again.');
    const wordId=active.queue[0];if(!wordId)throw new Error('This session is complete.');
    const previous=await database.progress.get(wordId);if(!previous)throw new Error('This word no longer exists.');
    const next=schedule(previous,correct,now);const review:Review={id:crypto.randomUUID(),wordId,sessionId:active.token,at:now,correct,previous,next};
    let words=await database.words.toArray();
    if(active.groupId){const ids=new Set((await database.memberships.where('groupId').equals(active.groupId).toArray()).map(m=>m.wordId));words=words.filter(w=>ids.has(w.id));}
    const eligible=new Set(words.map(w=>w.id)),known=new Set(active.initialIds);
    const added=shuffle(words.filter(w=>!known.has(w.id)).map(w=>w.id));
    const initialIds=[...active.initialIds.filter(id=>eligible.has(id)),...added];
    const queue=[...new Set([...active.queue.slice(1).filter(id=>eligible.has(id)&&id!==wordId),...added])];
    const handoffLevel=queue.length?undefined:(await database.studyState.get('hsk'))?.lastLevel??1;
    await database.progress.put(next);await database.reviews.add(review);
    await database.sessions.put({...active,queue,initialIds,handoffLevel,revision:active.revision+1,history:[...active.history.slice(-99),{reviewId:review.id,queueBefore:active.queue}]});
    return handoffLevel??null;
  });
}
export async function undoAnswer(database:PocketDB,session:Session){
  await database.transaction('rw',[database.sessions,database.progress,database.reviews],async()=>{
    const active=await database.sessions.get('active');if(!active||active.token!==session.token||active.revision!==session.revision)throw new Error('The session changed. Please try again.');
    const step=active.history.at(-1);if(!step)return;
    const review=await database.reviews.get(step.reviewId);if(!review)throw new Error('This answer is no longer available to undo.');
    const progress=await database.progress.get(review.wordId);if(progress?.revision!==review.next.revision)throw new Error('This word changed after the answer. Undo is unavailable.');
    await database.progress.put(review.previous);await database.reviews.delete(review.id);await database.sessions.put({...active,queue:step.queueBefore,handoffLevel:undefined,history:active.history.slice(0,-1),revision:active.revision+1});
  });
}
