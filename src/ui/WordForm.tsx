import {useEffect,useState,type FormEvent} from 'react';
import {Check,Plus,Trash2} from 'lucide-react';
import {db} from '../db';
import {saveWord} from '../vocabulary';
import type {Group,Membership,Word} from '../model';
import {suggestions,type Suggestion} from '../dictionary';
import {Confirm} from './Modal';
export function WordForm({word,groups,memberships,onSaved,onDelete,notify,onNewGroup}:{word?:Word;groups:Group[];memberships:Membership[];onSaved:(id:string)=>void;onDelete?:(word:Word)=>void;notify:(s:string)=>void;onNewGroup:()=>void}){
  const [hanzi,setHanzi]=useState(word?.hanzi??''),[pinyin,setPinyin]=useState(word?.pinyin??''),[meaning,setMeaning]=useState(word?.meaning??'');
  const [groupIds,setGroups]=useState(memberships.filter(m=>m.wordId===word?.id).map(m=>m.groupId));
  const [choices,setChoices]=useState<Suggestion[]>([]),[lookupStatus,setLookupStatus]=useState(''),[replace,setReplace]=useState<Suggestion|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let active=true;if(!hanzi.trim()){setChoices([]);setLookupStatus('');return;}setLookupStatus('Looking in your offline dictionary…');const timer=setTimeout(()=>{suggestions(hanzi).then(values=>{if(active){setChoices(values);setLookupStatus(values.length?'':'No exact dictionary entry. You can enter this word manually.');}}).catch(()=>{if(active){setChoices([]);setLookupStatus('Dictionary unavailable. Manual entry still works.');}});},250);return()=>{active=false;clearTimeout(timer);};},[hanzi]);
  const apply=(choice:Suggestion)=>{setPinyin(choice.pinyin);setMeaning(choice.meaning);setReplace(null);};
  const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const id=await saveWord(db,{hanzi,pinyin,meaning,groupIds:groupIds.filter(id=>groups.some(g=>g.id===id))},word?.id);notify(word?'Word updated.':'A new word in your pocket.');onSaved(id);}catch(error){setError(error instanceof Error?error.message:'Could not save this word.');}finally{setBusy(false);}};
  return <form onSubmit={submit} className="word-form">
    <label className="field">Chinese characters<input name="hanzi" autoFocus={!word} value={hanzi} onChange={e=>setHanzi(e.target.value)} placeholder="明天" lang="zh-Hans" required maxLength={100} autoComplete="off" className="hanzi-input"/></label>
    {hanzi.trim()&&<section className="suggestions" aria-label="Dictionary suggestions"><span className="eyebrow">Offline dictionary</span>{lookupStatus&&<p className="muted small" role="status">{lookupStatus}</p>}{choices.length>0&&<div className="suggestion-list">{choices.map((choice,i)=><button type="button" key={i} className="suggestion" onClick={()=>{if((pinyin&&pinyin!==choice.pinyin)||(meaning&&meaning!==choice.meaning))setReplace(choice);else apply(choice);}}><strong>{choice.pinyin}</strong><span>{choice.meaning}</span><small>Use this suggestion</small></button>)}</div>}</section>}
    <label className="field">Pinyin with tone marks<input name="pinyin" value={pinyin} onChange={e=>setPinyin(e.target.value)} placeholder="míngtiān" required maxLength={300} autoComplete="off"/></label>
    <label className="field">English meaning<textarea name="meaning" value={meaning} onChange={e=>setMeaning(e.target.value)} placeholder="Tomorrow" required maxLength={2000} rows={2}/></label>
    <fieldset className="group-field"><legend className="eyebrow">In these collections</legend><div className="group-pills">{groups.map(group=><button type="button" className={`group-pill ${groupIds.includes(group.id)?'selected':''}`} aria-pressed={groupIds.includes(group.id)} key={group.id} onClick={()=>setGroups(ids=>ids.includes(group.id)?ids.filter(id=>id!==group.id):[...ids,group.id])}>{group.name}</button>)}<button type="button" className="group-pill" onClick={onNewGroup}><Plus size={14}/>New group</button></div></fieldset>
    {error&&<p className="error-message" role="alert">{error}</p>}<button className="button" type="submit" disabled={busy}><Check size={17}/>{busy?'Saving…':word?'Save changes':'Save word'}</button>
    <p className="small muted form-footnote">Stored on this device. Make regular backups.</p>
    {word&&onDelete&&<button type="button" className="text-button destructive" onClick={()=>onDelete(word)}><Trash2 size={16}/>Delete word</button>}
    {replace&&<Confirm title="Use this suggestion?" description="This will replace your current pronunciation or meaning. Your word is saved only when you tap Save." label="Use suggestion" onClose={()=>setReplace(null)} onConfirm={()=>apply(replace)}/>}
  </form>;
}
