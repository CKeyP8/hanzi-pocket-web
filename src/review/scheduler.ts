import {type Progress,type Word,type Preferences,type Review} from '../model';
const DAY=86400000;
const intervals=[1,3,7,14,30,60,120,240,365];
export function schedule(previous:Progress,correct:boolean,now:number):Progress{
  const streak=correct?previous.streak+1:0;
  const intervalDays=correct?intervals[Math.min(streak-1,intervals.length-1)]:0;
  return {...previous,streak,intervalDays,correct:previous.correct+(correct?1:0),incorrect:previous.incorrect+(correct?0:1),lastReviewedAt:now,dueAt:now+(correct?intervalDays*DAY:10*60000),revision:previous.revision+1};
}
export function shuffle<T>(array:T[],random=Math.random):T[]{const copy=[...array];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
export function chooseCards(words:Word[],progress:Progress[],_reviews:Review[],prefs:Pick<Preferences,'mode'>,now=Date.now()):string[]{
  const states=new Map(progress.map(p=>[p.wordId,p]));
  if(prefs.mode==='random')return shuffle(words).map(w=>w.id);
  const fresh=words.filter(w=>states.get(w.id)?.lastReviewedAt===null).sort((a,b)=>a.createdAt-b.createdAt);
  const learned=words.filter(w=>states.has(w.id)&&states.get(w.id)!.lastReviewedAt!==null).sort((a,b)=>states.get(a.id)!.dueAt-states.get(b.id)!.dueAt);
  const due=learned.filter(w=>states.get(w.id)!.dueAt<=now),later=learned.filter(w=>states.get(w.id)!.dueAt>now);
  return [...due,...fresh,...later].map(w=>w.id);
}
