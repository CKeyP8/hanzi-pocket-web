export interface Word { id:string; hanzi:string; normalized:string; pinyin:string; meaning:string; createdAt:number; updatedAt:number }
export interface Group { id:string; name:string; createdAt:number; updatedAt:number }
export interface Membership { wordId:string; groupId:string }
export interface Progress { wordId:string; streak:number; correct:number; incorrect:number; dueAt:number; intervalDays:number; lastReviewedAt:number|null; revision:number }
export interface Review { id:string; wordId:string; sessionId:string; at:number; correct:boolean; previous:Progress; next:Progress }
export interface SessionStep { reviewId:string; queueBefore:string[] }
export interface Session { id:'active'; token:string; queue:string[]; initialIds:string[]; history:SessionStep[]; startedAt:number; groupId:string|null; mode:'scheduled'|'random'; revision:number; handoffLevel?:number }
export interface HSKProgress {wordId:string;level:number;attempts:number;correct:number;incorrect:number;lastCorrect:boolean;lastSeenAt:number;revision:number}
export interface HSKStep {wordId:string;previous:HSKProgress|null;nextRevision:number;queueBefore:string[]}
export interface HSKSession {level:number;token:string;scopeIds:string[];queue:string[];history:HSKStep[];revision:number}
export interface StudyState {id:'hsk';lastLevel:number}
export interface Preferences { id:'preferences'; newPerDay:number; sessionSize:number; mode:'scheduled'|'random'; groupId:string|null; appearance:'light'|'dark'|'system'; sound:boolean; reducedMotion:boolean; columns:3|4|5; onboarded:boolean; lastBackupAt:number|null }
export const defaultPreferences:Preferences={id:'preferences',newPerDay:10,sessionSize:20,mode:'scheduled',groupId:null,appearance:'light',sound:false,reducedMotion:false,columns:3,onboarded:false,lastBackupAt:null};
export const freshProgress=(wordId:string,now=Date.now()):Progress=>({wordId,streak:0,correct:0,incorrect:0,dueAt:now,intervalDays:0,lastReviewedAt:null,revision:0});
export const normalizedHanzi=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,'');
export const searchable=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'');
export const dayStart=(now=Date.now())=>{const date=new Date(now);date.setHours(0,0,0,0);return date.getTime();};
