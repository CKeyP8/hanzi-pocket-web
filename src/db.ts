import Dexie, {type EntityTable} from 'dexie';
import type {Word,Group,Membership,Progress,Review,Session,Preferences,HSKProgress,HSKSession,StudyState} from './model';
import {defaultPreferences} from './model';

export class PocketDB extends Dexie {
  words!:EntityTable<Word,'id'>; groups!:EntityTable<Group,'id'>;
  memberships!:Dexie.Table<Membership,[string,string]>;
  progress!:EntityTable<Progress,'wordId'>; reviews!:EntityTable<Review,'id'>;
  sessions!:EntityTable<Session,'id'>; preferences!:EntityTable<Preferences,'id'>;
  hskProgress!:EntityTable<HSKProgress,'wordId'>; hskSessions!:EntityTable<HSKSession,'level'>; studyState!:EntityTable<StudyState,'id'>;
  constructor(name='hanzi-pocket-v1') {
    super(name);
    this.version(1).stores({words:'id,&normalized,createdAt,pinyin',groups:'id,name',memberships:'[wordId+groupId],wordId,groupId',progress:'wordId,dueAt',reviews:'id,wordId,at,sessionId',sessions:'id',preferences:'id'});
    this.version(2).stores({hskProgress:'wordId,level,lastSeenAt',hskSessions:'level',studyState:'id'});
  }
  async initialize(){await this.transaction('rw',this.preferences,async()=>{if(!await this.preferences.get('preferences'))await this.preferences.add({...defaultPreferences});});}
}
export const db=new PocketDB(import.meta.env.BASE_URL==='/'?'hanzi-pocket-v1':`hanzi-pocket-v1:${import.meta.env.BASE_URL}`);
