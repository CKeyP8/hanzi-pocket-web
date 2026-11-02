import type {PocketDB} from './db';
import type {HSKProgress,HSKSession} from './model';
import type {CatalogWord} from './catalog';
import {shuffle} from './review/scheduler';

export function hskStats(words:CatalogWord[],progress:HSKProgress[]){
  const ids=new Set(words.map(w=>w.id)),seen=progress.filter(p=>ids.has(p.wordId));
  return {seen:seen.length,unseen:words.length-seen.length,missed:seen.filter(p=>!p.lastCorrect).length};
}

function buildQueue(words:CatalogWord[],progress:HSKProgress[],preferred:string[]=[],avoidFirst?:string){
  const states=new Map(progress.map(p=>[p.wordId,p]));
  const priority=words.filter(w=>!states.has(w.id)||!states.get(w.id)!.lastCorrect);
  const allowed=new Set((priority.length?priority:words).map(w=>w.id));
  const kept=[...new Set(preferred.filter(id=>allowed.has(id)))],keptIds=new Set(kept);
  const queue=[...kept,...shuffle([...allowed].filter(id=>!keptIds.has(id)))];
  if(!priority.length&&queue.length>1&&queue[0]===avoidFirst)queue.push(queue.shift()!);
  return queue;
}

export async function startHSKSession(database:PocketDB,words:CatalogWord[],level:number){
  if(!Number.isInteger(level)||level<1||level>5||!words.length||words.some(w=>w.level!==level))throw new Error('Choose an HSK level to practice.');
  return database.transaction('rw',[database.hskProgress,database.hskSessions,database.studyState],async()=>{
    const old=await database.hskSessions.get(level),progress=await database.hskProgress.where('level').equals(level).toArray();
    const session:HSKSession={level,token:crypto.randomUUID(),scopeIds:words.map(w=>w.id),queue:buildQueue(words,progress,old?.queue),history:[],revision:0};
    await database.hskSessions.put(session);await database.studyState.put({id:'hsk',lastLevel:level});return session;
  });
}

export async function answerHSKCard(database:PocketDB,session:HSKSession,words:CatalogWord[],correct:boolean,now=Date.now()){
  return database.transaction('rw',[database.hskProgress,database.hskSessions],async()=>{
    const active=await database.hskSessions.get(session.level);
    if(!active||active.token!==session.token||active.revision!==session.revision)throw new Error('This HSK review changed in another window. Please reopen the level.');
    const wordId=active.queue[0];if(!wordId)throw new Error('No HSK word is available.');
    const previous=await database.hskProgress.get(wordId)??null;
    const next:HSKProgress={wordId,level:active.level,attempts:(previous?.attempts??0)+1,correct:(previous?.correct??0)+(correct?1:0),incorrect:(previous?.incorrect??0)+(correct?0:1),lastCorrect:correct,lastSeenAt:now,revision:(previous?.revision??0)+1};
    const queue=active.queue.slice(1);if(!correct)queue.splice(Math.min(3,queue.length),0,wordId);
    await database.hskProgress.put(next);
    const progress=await database.hskProgress.where('level').equals(active.level).toArray();
    const scope=new Set(active.scopeIds),scopeWords=words.filter(w=>scope.has(w.id));
    if(!scopeWords.some(w=>w.id===wordId))throw new Error('This HSK collection changed. Please reopen it.');
    await database.hskSessions.put({...active,queue:buildQueue(scopeWords,progress,queue,wordId),history:[...active.history.slice(-99),{wordId,previous,nextRevision:next.revision,queueBefore:active.queue}],revision:active.revision+1});
  });
}

export async function undoHSKAnswer(database:PocketDB,session:HSKSession){
  await database.transaction('rw',[database.hskProgress,database.hskSessions],async()=>{
    const active=await database.hskSessions.get(session.level);
    if(!active||active.token!==session.token||active.revision!==session.revision)throw new Error('This HSK review changed. Please reopen the level.');
    const step=active.history.at(-1);if(!step)return;
    const progress=await database.hskProgress.get(step.wordId);
    if(progress?.revision!==step.nextRevision)throw new Error('This HSK word changed after the answer.');
    if(step.previous)await database.hskProgress.put(step.previous);else await database.hskProgress.delete(step.wordId);
    await database.hskSessions.put({...active,queue:step.queueBefore,history:active.history.slice(0,-1),revision:active.revision+1});
  });
}
