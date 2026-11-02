import type {PocketDB} from './db';
export async function saveGroup(database:PocketDB,name:string,id?:string){
  name=name.trim();if(!name||name.length>80)throw new Error('Choose a group name between 1 and 80 characters.');
  const old=id?await database.groups.get(id):undefined;if(id&&!old)throw new Error('This group no longer exists.');
  const now=Date.now(),groupId=id??crypto.randomUUID();await database.groups.put({id:groupId,name,createdAt:old?.createdAt??now,updatedAt:now});return groupId;
}
export async function deleteGroup(database:PocketDB,id:string){
  await database.transaction('rw',[database.groups,database.memberships,database.preferences,database.sessions],async()=>{
    await database.memberships.where('groupId').equals(id).delete();await database.groups.delete(id);
    const prefs=await database.preferences.get('preferences');if(prefs?.groupId===id)await database.preferences.put({...prefs,groupId:null});
    const session=await database.sessions.get('active');if(session?.groupId===id)await database.sessions.put({...session,groupId:null,revision:session.revision+1});
  });
}
export async function assignWords(database:PocketDB,wordIds:string[],groupId:string,remove=false){
  await database.transaction('rw',[database.memberships,database.words,database.groups],async()=>{
    if(!await database.groups.get(groupId))throw new Error('This group no longer exists.');
    const ids=[...new Set(wordIds)];if((await database.words.bulkGet(ids)).some(w=>!w))throw new Error('One of these words has been deleted.');
    if(remove)await database.memberships.bulkDelete(ids.map(id=>[id,groupId]));
    else await database.memberships.bulkPut(ids.map(wordId=>({wordId,groupId})));
  });
}
