import {useEffect,useRef,useState} from 'react';
import HanziWriter from 'hanzi-writer';
import {Volume2,PenLine,Play,RotateCcw,StepForward} from 'lucide-react';
import {speakChinese,stopSpeech} from '../speech';
import {Modal} from './Modal';
import {appAsset} from '../assets';
const shardCache=new Map<number,Promise<Record<string,unknown>>>();
async function strokeData(char:string){
  const index=char.codePointAt(0)!%16;
  if(!shardCache.has(index))shardCache.set(index,fetch(appAsset(`strokes/${index}.json`)).then(r=>{if(!r.ok)throw new Error('Stroke data is unavailable.');return r.json();}).catch(e=>{shardCache.delete(index);throw e;}));
  const data=await shardCache.get(index)!;if(!Object.hasOwn(data,char))throw new Error('Stroke order is not bundled for this character. The offline pack covers the HSK 1–5 characters.');return data[char];
}
export function LearnTools({hanzi,pinyin,reduced=false}:{hanzi:string;pinyin:string;reduced?:boolean}){
  const [open,setOpen]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const handler=(event:Event)=>setError((event as CustomEvent<string>).detail);window.addEventListener('pocket-speech-error',handler);return()=>{stopSpeech();window.removeEventListener('pocket-speech-error',handler);};},[hanzi]);
  const speak=async(slow:boolean)=>{setError('');try{await speakChinese(hanzi,slow);}catch(e){setError(e instanceof Error?e.message:'Audio could not play.');}};
  return <div className="learn-tools" data-gesture-ignore><div className="learn-tool-buttons"><button className="text-button" onClick={()=>void speak(false)}><Volume2 size={17}/>Listen</button><button className="text-button" onClick={()=>void speak(true)}>Slow</button><button className="text-button" onClick={()=>{stopSpeech();setOpen(true);}}><PenLine size={17}/>Strokes</button></div>{error&&<p className="small error-message" role="alert">{error}</p>}{open&&<StrokePanel hanzi={hanzi} pinyin={pinyin} reduced={reduced} onClose={()=>setOpen(false)}/>}</div>;
}
function StrokePanel({hanzi,pinyin,reduced,onClose}:{hanzi:string;pinyin:string;reduced:boolean;onClose:()=>void}){
  const characters=[...hanzi].filter(char=>/\p{Script=Han}/u.test(char));
  const [index,setIndex]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true),[step,setStep]=useState(0),[busy,setBusy]=useState(false);
  const target=useRef<HTMLDivElement>(null),writer=useRef<ReturnType<typeof HanziWriter.create>|null>(null),strokeCount=useRef(0),generation=useRef(0);
  const char=characters[index];
  useEffect(()=>{
    const version=++generation.current;let active=true;setError('');setLoading(true);setStep(0);setBusy(false);writer.current=null;
    const element=target.current!;element.replaceChildren();
    void strokeData(char).then(data=>{if(!active||version!==generation.current)return;strokeCount.current=(data as {strokes:unknown[]}).strokes.length;const size=Math.min(300,element.clientWidth||280);const styles=getComputedStyle(document.documentElement);writer.current=HanziWriter.create(element,char,{width:size,height:size,padding:24,showCharacter:false,showOutline:true,strokeColor:styles.getPropertyValue('--ink').trim(),outlineColor:styles.getPropertyValue('--wash').trim(),highlightColor:styles.getPropertyValue('--navy').trim(),delayBetweenStrokes:reduced?0:250,strokeAnimationSpeed:reduced?1000:1,strokeHighlightSpeed:reduced?1000:2,strokeFadeDuration:reduced?0:400,charDataLoader:()=>data as never});setLoading(false);}).catch(e=>{if(active){setLoading(false);setError(e.message);}});
    return()=>{active=false;generation.current++;writer.current?.pauseAnimation();element.replaceChildren();};
  },[char,reduced]);
  const play=async()=>{const current=writer.current;if(!current||busy)return;const version=generation.current;setBusy(true);setStep(0);try{await current.hideCharacter();await current.animateCharacter({onComplete:()=>{if(version===generation.current)setStep(strokeCount.current);}});}finally{if(version===generation.current)setBusy(false);}};
  const next=async()=>{const current=writer.current;if(!current||busy||step>=strokeCount.current)return;const version=generation.current;setBusy(true);try{await current.animateStroke(step);if(version===generation.current)setStep(step+1);}finally{if(version===generation.current)setBusy(false);}};
  const reset=async()=>{const current=writer.current;if(!current||busy)return;const version=generation.current;setBusy(true);try{await current.hideCharacter();if(version===generation.current)setStep(0);}finally{if(version===generation.current)setBusy(false);}};
  return <Modal title="Stroke order" onClose={onClose}><p className="small muted">{hanzi} · {pinyin}</p><div className="stroke-character-tabs">{characters.map((c,i)=><button className={`group-pill ${i===index?'selected':''}`} key={i} onClick={()=>setIndex(i)} aria-pressed={i===index} lang="zh-Hans">{c}</button>)}</div><div className="stroke-frame"><div ref={target} className="stroke-target" role="img" aria-label={`Stroke order for ${char}`}/></div>{loading&&<p className="small muted" role="status">Opening offline strokes…</p>}{error?<p className="error-message" role="alert">{error}</p>:<><div className="stroke-actions"><button className="button secondary" disabled={loading||busy} onClick={()=>void play()}><Play size={16}/>Replay</button><button className="button secondary" disabled={loading||busy||step>=strokeCount.current} onClick={()=>void next()}><StepForward size={16}/>Next stroke</button><button className="icon-button" disabled={loading||busy} aria-label="Reset strokes" onClick={()=>void reset()}><RotateCcw size={17}/></button></div><p className="small muted" aria-live="polite">{step} / {strokeCount.current} strokes</p></>}<p className="small muted">Each new stroke stays visible. Reset to start again. Stroke data: Make Me a Hanzi / Arphic.</p></Modal>;
}
