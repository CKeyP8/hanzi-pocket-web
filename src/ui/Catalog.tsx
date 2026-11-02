import {useEffect,useMemo,useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {ArrowLeft,ArrowRight,Bookmark,BookmarkCheck,Play,Search} from 'lucide-react';
import {db} from '../db';
import {loadCatalog,saveCatalogWord,type CatalogWord} from '../catalog';
import {startHSKSession,answerHSKCard,undoHSKAnswer,hskStats} from '../hsk-study';
import {filterLibrary} from '../library';
import {shuffle} from '../review/scheduler';
import {Gallery} from './Gallery';
import {Flashcard} from './Flashcard';
import {Modal} from './Modal';
import {LearnTools} from './LearnTools';
export function Catalog({onStudy,reduced,notify}:{onStudy:(words:CatalogWord[],level:number)=>void;reduced:boolean;notify:(s:string)=>void}){
  const [words,setWords]=useState<CatalogWord[]>([]),[error,setError]=useState(''),[level,setLevel]=useState<number|null>(null),[query,setQuery]=useState(''),[detail,setDetail]=useState<CatalogWord|null>(null);
  const saved=useLiveQuery(()=>db.words.toArray(),[])??[];
  const savedKeys=new Set(saved.map(w=>w.normalized));
  const progress=useLiveQuery(()=>db.hskProgress.toArray(),[])??[];
  const last=useLiveQuery(()=>db.studyState.get('hsk'),[]);
  useEffect(()=>{let active=true;void loadCatalog().then(items=>{if(active)setWords(items);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  const visible=useMemo(()=>filterLibrary(words.filter(w=>!level||w.level===level),query,'pinyin',[]) as CatalogWord[],[words,level,query]);
  const save=async(word:CatalogWord)=>{try{await saveCatalogWord(db,word);notify('Saved to My Pocket. Ready for your personal reviews.');}catch(e){notify(e instanceof Error?e.message:'Could not save word.');}};
  return <section className="catalog-page"><div className="page-heading compact"><div className="heading-row">{level&&<button className="icon-button" aria-label="All HSK levels" onClick={()=>{setLevel(null);setQuery('');window.scrollTo(0,0);}}><ArrowLeft size={20}/></button>}<h1>{level?`HSK ${level}`:'A world of words.'}</h1></div><p className="muted">Editorial Focus · HSK 1–5<br/>Your place is saved. New words and missed answers come first.</p></div>{error&&<p className="error-message" role="alert">{error}</p>}{!words.length&&!error&&<p className="muted" role="status">Opening your offline HSK library…</p>}
    {level===null&&last&&words.length>0&&<button className="button secondary hsk-continue" onClick={()=>onStudy(words.filter(w=>w.level===last.lastLevel),last.lastLevel)}>Continue HSK {last.lastLevel}<Play size={16}/></button>}{level===null&&!query?<div className="hsk-albums">{[1,2,3,4,5].map(band=>{const items=words.filter(w=>w.level===band),count=items.filter(w=>savedKeys.has(w.normalized)).length,stats=hskStats(items,progress);return <button className="hsk-album" key={band} onClick={()=>{setLevel(band);window.scrollTo(0,0);}}><div><span className="eyebrow">Built-in collection</span><h2>HSK {band}</h2><p>{items.length} entries · {count} saved</p><small>{stats.seen} seen · {stats.unseen} new · {stats.missed} to revisit</small></div><span className="hsk-cover" aria-hidden="true" lang="zh-Hans">{['初','知','进','远','深'][band-1]}</span><ArrowRight size={18}/></button>;})}</div>:<><label className="search-field"><Search size={17}/><input type="search" aria-label="Search HSK vocabulary" placeholder="Characters, pinyin, meaning" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="catalog-toolbar"><span className="small muted">{visible.length} entries · {visible.filter(w=>savedKeys.has(w.normalized)).length} saved</span><button className="text-button" disabled={!visible.length} onClick={()=>onStudy(shuffle(visible),level??0)}><Play size={15}/>{hskStats(visible,progress).seen?'Continue cards':'Explore cards'}</button></div><Gallery words={visible} columns={3} selected={new Set()} selecting={false} onSelect={()=>{}} onOpen={id=>setDetail(words.find(w=>w.id===id)??null)}/></>}
    {detail&&<Modal title={`HSK ${detail.level} word`} onClose={()=>setDetail(null)}><div className="word-detail"><span className="detail-hanzi" lang="zh-Hans">{detail.hanzi}</span><p className="detail-pinyin">{detail.pinyin}</p><p className="detail-meaning">{detail.meaning}</p><LearnTools hanzi={detail.hanzi} pinyin={detail.pinyin} reduced={reduced}/><button className="button" disabled={savedKeys.has(detail.normalized)} onClick={()=>void save(detail)}>{savedKeys.has(detail.normalized)?<BookmarkCheck size={17}/>:<Bookmark size={17}/>} {savedKeys.has(detail.normalized)?'Saved in My Pocket':'Save to My Pocket'}</button><p className="small muted">Your personal schedule starts when you save. Browsing does not record a review.</p></div></Modal>}
  </section>;
}
export function CatalogStudy({words,level,reduced,onExit,notify,onUndoPocket}:{words:CatalogWord[];level:number;reduced:boolean;onExit:()=>void;notify:(s:string)=>void;onUndoPocket?:()=>Promise<void>}){
  const [ready,setReady]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const session=useLiveQuery(()=>db.hskSessions.get(level),[level]);
  const progress=useLiveQuery(()=>db.hskProgress.where('level').equals(level).toArray(),[level])??[];
  const saved=useLiveQuery(()=>db.words.toArray(),[])??[];
  useEffect(()=>{let active=true;setReady('');setError('');void startHSKSession(db,words,level).then(session=>{if(active)setReady(session.token);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[words,level]);
  const word=words.find(w=>w.id===session?.queue[0]),stats=hskStats(words,progress);
  const run=async(action:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);try{await action();}catch(e){notify(e instanceof Error?e.message:'Could not save your HSK progress.');}finally{setBusy(false);}};
  if(error)return <section className="session-complete"><h1>Your HSK review needs a moment.</h1><p className="error-message" role="alert">{error}</p><button className="button" onClick={onExit}>Back to HSK library</button></section>;
  if(!ready||!session||session.token!==ready||!word)return <div className="boot-screen"><p role="status">Resuming HSK {level}…</p></div>;
  const isSaved=saved.some(w=>w.normalized===word.normalized);
  return <Flashcard word={word} reduced={reduced} busy={busy} resetKey={`hsk:${session.token}:${session.revision}`} title={`HSK ${level} · Explore`} subtitle={stats.unseen||stats.missed?`${stats.unseen} new · ${stats.missed} to revisit`:'Familiar words · keep practicing'} onExit={onExit} onAnswer={correct=>void run(()=>answerHSKCard(db,session,words,correct))} onUndo={()=>void run(()=>session.history.length?undoHSKAnswer(db,session):onUndoPocket!())} canUndo={!!session.history.length||!!onUndoPocket} saveControl={<button className="study-bookmark" disabled={busy||isSaved} aria-label={isSaved?'Saved in My Pocket':'Save to My Pocket'} onClick={()=>void run(async()=>{await saveCatalogWord(db,word);notify('Saved to My Pocket.');})}>{isSaved?<BookmarkCheck size={17}/>:<Bookmark size={17}/>}<span>{isSaved?'Saved':'Save'}</span></button>}/>;
}
