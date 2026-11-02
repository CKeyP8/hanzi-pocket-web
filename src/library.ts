import {searchable,type Word} from './model';
export type Sort='random'|'recent'|'pinyin';
export function filterLibrary(words:Word[],query:string,sort:Sort,order:string[]){
  const term=searchable(query);const rank=new Map(order.map((id,i)=>[id,i]));
  return words.filter(w=>!term||searchable(`${w.hanzi} ${w.pinyin} ${w.meaning}`).includes(term)).sort((a,b)=>sort==='recent'?b.createdAt-a.createdAt:sort==='pinyin'?a.pinyin.localeCompare(b.pinyin):((rank.get(a.id)??Number.MAX_SAFE_INTEGER)-(rank.get(b.id)??Number.MAX_SAFE_INTEGER)||a.createdAt-b.createdAt));
}
