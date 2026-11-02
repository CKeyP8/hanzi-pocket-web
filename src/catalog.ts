import type {Word} from './model';
import type {PocketDB} from './db';
import {saveWord} from './vocabulary';
import {appAsset} from './assets';
export interface CatalogWord extends Word {level:number}
let catalog:Promise<CatalogWord[]>|null=null;
export function loadCatalog(){
  catalog??=fetch(appAsset('hsk-catalog.json')).then(async response=>{if(!response.ok)throw new Error('The HSK library is unavailable. Finish offline setup while connected.');return response.json() as Promise<CatalogWord[]>;}).catch(error=>{catalog=null;throw error;});
  return catalog;
}
export async function saveCatalogWord(database:PocketDB,word:CatalogWord){
  return database.transaction('rw',[database.words,database.progress,database.memberships,database.groups],async()=>{
    const old=await database.words.where('normalized').equals(word.normalized).first();
    if(old)return old.id;
    return saveWord(database,{hanzi:word.hanzi,pinyin:word.pinyin,meaning:word.meaning,groupIds:[]});
  });
}
